// Reproductor de ejercicios: hace sonar la batería y el click juntos,
// y avisa qué nota suena en cada momento para mover el cursor de la partitura.
//
// Usa el mismo principio que el metrónomo: un temporizador revisa cada 25 ms y
// programa con 100 ms de adelanto usando el reloj de audio. Aquí, además, la
// posición se mide en ticks desde el inicio, así el click y la batería salen
// del mismo cálculo y no se pueden desincronizar entre sí.

import { programarClick } from '../audio/click'
import { programarPieza } from '../audio/bateria'
import type { Ejercicio, Pieza } from './tipos'
import { esSilencio, ticksDeNota, ticksPorCompas, ticksPorPulso } from './tipos'

const REVISION_MS = 25
const VENTANA_S = 0.1

export interface OpcionesReproductor {
  bpm: number
  loop: boolean
  conClick: boolean
  /** Voces apagadas, para estudiar solo las manos o solo los pies. */
  silenciarManos: boolean
  silenciarPies: boolean
  /** Una vuelta con batería y la siguiente solo con click, para imitar. */
  escucharYTocar: boolean
  volumenBateria: number
  volumenClick: number
  cuentaEntrada: 0 | 1 | 2
}

type TipoEvento = 'nota' | 'click'

interface Evento {
  /** Posición en ticks dentro de la pasada (los de la cuenta son negativos). */
  ticks: number
  tipo: TipoEvento
  compas: number
  // Solo para notas:
  voz?: 'manos' | 'pies'
  indice?: number
  piezas?: Pieza[]
  acento?: boolean
  // Solo para clicks:
  pulso?: number
}

export interface EventoReproduccion {
  cuando: number
  tipo: TipoEvento
  compas: number
  voz?: 'manos' | 'pies'
  indice?: number
  pulso?: number
  enCuentaEntrada: boolean
  /** Vuelta actual, empezando en 0. */
  vuelta: number
  /** En el modo "escuchar y tocar", si esta vuelta va sin batería. */
  soloClick: boolean
}

export interface Reproductor {
  iniciar(): void
  detener(): void
  estaSonando(): boolean
  cambiarBpm(bpm: number): void
  actualizar(opciones: OpcionesReproductor): void
  alEvento(escucha: (evento: EventoReproduccion) => void): void
}

/** Convierte el ejercicio en una lista de eventos ordenados por tiempo. */
function armarEventos(ejercicio: Ejercicio): Evento[] {
  const porPulso = ticksPorPulso(ejercicio.compas)
  const porCompas = ticksPorCompas(ejercicio.compas)
  const eventos: Evento[] = []

  ejercicio.compases.forEach((compas, numero) => {
    const base = numero * porCompas

    // Click en cada pulso.
    for (let pulso = 0; pulso < ejercicio.compas.pulsos; pulso++) {
      eventos.push({ ticks: base + pulso * porPulso, tipo: 'click', compas: numero, pulso })
    }

    for (const voz of ['manos', 'pies'] as const) {
      let ticks = 0
      compas[voz].forEach((nota, indice) => {
        if (!esSilencio(nota)) {
          eventos.push({
            ticks: base + ticks,
            tipo: 'nota',
            compas: numero,
            voz,
            indice,
            piezas: nota.piezas,
            acento: nota.acento,
          })
        } else {
          // Los silencios no suenan, pero el cursor debe pasar por ellos.
          eventos.push({ ticks: base + ticks, tipo: 'nota', compas: numero, voz, indice, piezas: [] })
        }
        ticks += ticksDeNota(nota)
      })
    }
  })

  // Orden estable: a igualdad de tiempo, primero el click.
  return eventos.sort((a, b) => a.ticks - b.ticks || (a.tipo === 'click' ? -1 : 1))
}

export function crearReproductor(
  contexto: AudioContext,
  ejercicio: Ejercicio,
  opcionesIniciales: OpcionesReproductor,
): Reproductor {
  let opciones = opcionesIniciales
  const eventos = armarEventos(ejercicio)
  const porPulso = ticksPorPulso(ejercicio.compas)
  const porCompas = ticksPorCompas(ejercicio.compas)
  const ticksPasada = ejercicio.compases.length * porCompas

  let sonando = false
  let temporizador: number | null = null
  let escucha: ((evento: EventoReproduccion) => void) | null = null

  /** Instante del reloj de audio que corresponde a la posición 0. */
  let origen = 0
  /** Posición absoluta: cuenta de entrada en negativo, luego vueltas seguidas. */
  let indice = 0
  let vuelta = 0
  let ticksCuenta = 0
  /** Sonidos ya programados que todavía no han sonado (para poder cancelarlos). */
  let programados: { nodo: AudioNode; cuando: number }[] = []

  const duracionPulso = (): number => 60 / opciones.bpm
  const tiempoDe = (posicion: number): number => origen + (posicion / porPulso) * duracionPulso()

  // --- Cuenta de entrada: solo clicks, en posiciones negativas ---
  const clicksDeCuenta = (): Evento[] => {
    const lista: Evento[] = []
    const compases = opciones.cuentaEntrada
    for (let c = 0; c < compases; c++) {
      for (let pulso = 0; pulso < ejercicio.compas.pulsos; pulso++) {
        lista.push({
          ticks: -(compases - c) * porCompas + pulso * porPulso,
          tipo: 'click',
          compas: -1,
          pulso,
        })
      }
    }
    return lista
  }

  let cuenta: Evento[] = []
  let indiceCuenta = 0

  const cancelarFuturos = (ahora: number): void => {
    for (const { nodo, cuando } of programados) {
      if (cuando <= ahora) continue
      // Bajar la ganancia a cero corta el sonido que aún no ha empezado.
      const ganancia = nodo as GainNode
      try {
        ganancia.gain?.cancelScheduledValues(ahora)
        if (ganancia.gain) ganancia.gain.value = 0
      } catch {
        // Si no era un nodo de ganancia, no hay nada que cortar.
      }
    }
    programados = programados.filter((p) => p.cuando <= ahora)
  }

  const sonarEvento = (evento: Evento, cuando: number, soloClick: boolean): void => {
    if (evento.tipo === 'click') {
      if (!opciones.conClick) return
      programarClick(contexto, {
        cuando,
        tipo: evento.pulso === 0 ? 'acento' : 'pulso',
        volumen: opciones.volumenClick,
      })
      return
    }

    if (soloClick) return
    if (!evento.piezas || evento.piezas.length === 0) return
    if (evento.voz === 'manos' && opciones.silenciarManos) return
    if (evento.voz === 'pies' && opciones.silenciarPies) return

    for (const pieza of evento.piezas) {
      const nodos = programarPieza(contexto, pieza, {
        cuando,
        volumen: opciones.volumenBateria,
        acento: evento.acento,
      })
      for (const nodo of nodos) programados.push({ nodo, cuando })
    }
  }

  const avisar = (evento: Evento, cuando: number, enCuenta: boolean, soloClick: boolean): void => {
    escucha?.({
      cuando,
      tipo: evento.tipo,
      compas: evento.compas,
      voz: evento.voz,
      indice: evento.indice,
      pulso: evento.pulso,
      enCuentaEntrada: enCuenta,
      vuelta,
      soloClick,
    })
  }

  const revisar = (): void => {
    const limite = contexto.currentTime + VENTANA_S
    if (programados.length > 64) {
      const ahora = contexto.currentTime
      programados = programados.filter((p) => p.cuando > ahora)
    }

    while (sonando) {
      // Primero la cuenta de entrada, si queda algo.
      if (indiceCuenta < cuenta.length) {
        const evento = cuenta[indiceCuenta]
        const cuando = tiempoDe(evento.ticks)
        if (cuando >= limite) return
        sonarEvento(evento, cuando, true)
        avisar(evento, cuando, true, true)
        indiceCuenta++
        continue
      }

      const evento = eventos[indice]
      const cuando = tiempoDe(vuelta * ticksPasada + evento.ticks)
      if (cuando >= limite) return

      // En "escuchar y tocar", las vueltas impares van sin batería.
      const soloClick = opciones.escucharYTocar && vuelta % 2 === 1
      sonarEvento(evento, cuando, soloClick)
      avisar(evento, cuando, false, soloClick)

      indice++
      if (indice >= eventos.length) {
        indice = 0
        vuelta++
        if (!opciones.loop && !(opciones.escucharYTocar && vuelta % 2 === 1)) {
          // Sin loop, se para al terminar la pasada (o el par escuchar/tocar).
          sonando = false
          if (temporizador !== null) {
            clearInterval(temporizador)
            temporizador = null
          }
          return
        }
      }
    }
  }

  return {
    iniciar(): void {
      if (sonando) return
      sonando = true
      indice = 0
      vuelta = 0
      indiceCuenta = 0
      cuenta = clicksDeCuenta()
      ticksCuenta = opciones.cuentaEntrada * porCompas
      // La posición 0 es el primer golpe del ejercicio; la cuenta va antes.
      origen = contexto.currentTime + 0.15 + (ticksCuenta / porPulso) * duracionPulso()
      revisar()
      temporizador = window.setInterval(revisar, REVISION_MS)
    },

    detener(): void {
      sonando = false
      if (temporizador !== null) {
        clearInterval(temporizador)
        temporizador = null
      }
      cancelarFuturos(contexto.currentTime)
    },

    estaSonando: () => sonando,

    cambiarBpm(nuevo: number): void {
      const anterior = opciones.bpm
      opciones = { ...opciones, bpm: nuevo }
      if (!sonando || nuevo === anterior) return

      // Se recoloca el origen para que la posición actual siga cayendo ahora
      // mismo: el cambio se nota enseguida y sin saltos.
      const ahora = contexto.currentTime
      const posicionAhora = ((ahora - origen) / (60 / anterior)) * porPulso
      origen = ahora - (posicionAhora / porPulso) * (60 / nuevo)
      cancelarFuturos(ahora)

      // Volvemos a colocar el índice en el primer evento que aún no ha sonado.
      indiceCuenta = cuenta.findIndex((e) => tiempoDe(e.ticks) > ahora)
      if (indiceCuenta === -1) indiceCuenta = cuenta.length
      if (indiceCuenta >= cuenta.length) {
        const dentro = posicionAhora - vuelta * ticksPasada
        indice = eventos.findIndex((e) => e.ticks > dentro)
        if (indice === -1) {
          indice = 0
          vuelta++
        }
      }
      revisar()
    },

    actualizar(nuevas: OpcionesReproductor): void {
      const bpm = nuevas.bpm
      opciones = { ...nuevas, bpm: opciones.bpm }
      if (bpm !== opciones.bpm) this.cambiarBpm(bpm)
    },

    alEvento(nueva): void {
      escucha = nueva
    },
  }
}

/** Cuántos segundos dura una vuelta completa del ejercicio. */
export function duracionDeVuelta(ejercicio: Ejercicio, bpm: number): number {
  const pulsos = ejercicio.compases.length * ejercicio.compas.pulsos
  return pulsos * (60 / bpm)
}
