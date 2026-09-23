// Batería de la app.
//
// Suena con grabaciones de una batería de verdad (ver public/sonidos/CREDITOS.md:
// pack Virtuosity Drums de Versilian Studios, licencia CC0 / dominio público).
// Pesan 218 KB en total, se descargan una vez y quedan guardadas para usarlas
// sin internet.
//
// Si por lo que sea no se pueden cargar (sin red la primera vez, por ejemplo),
// la app no se queda muda: hay una batería sintetizada de respaldo, hecha con
// ruido filtrado y osciladores. Nunca suena igual de bien, pero deja practicar.
//
// Todo se programa con instantes exactos del reloj de audio, igual que el click.

import { obtenerSalidaBateria } from './contexto'
import type { Pieza } from '../ejercicios/tipos'

/**
 * Archivo de cada pieza. El pack solo trae dos toms, así que el de piso es el
 * tom grave con la afinación bajada.
 */
const ARCHIVOS: Record<Pieza, { archivo: string; velocidad?: number }> = {
  bombo: { archivo: 'bombo' },
  tarola: { archivo: 'tarola' },
  tarolaAro: { archivo: 'tarolaAro' },
  aro: { archivo: 'aro' },
  hiHatCerrado: { archivo: 'hiHatCerrado' },
  hiHatAbierto: { archivo: 'hiHatAbierto' },
  hiHatPedal: { archivo: 'hiHatPedal' },
  ride: { archivo: 'ride' },
  campana: { archivo: 'campana' },
  crash: { archivo: 'crash' },
  tomAgudo: { archivo: 'tomAgudo' },
  tomMedio: { archivo: 'tomMedio' },
  tomPiso: { archivo: 'tomMedio', velocidad: 0.76 },
}

const sonidos = new Map<string, AudioBuffer>()
let cargando: Promise<void> | null = null

/** ¿Están listos los sonidos reales? */
export const haySonidosReales = (): boolean => sonidos.size > 0

/**
 * Descarga y prepara los sonidos de la batería. Se puede llamar varias veces:
 * solo descarga la primera. Si falla, la app sigue con la batería sintetizada.
 */
export function cargarBateria(contexto: AudioContext): Promise<void> {
  if (cargando) return cargando
  const nombres = [...new Set(Object.values(ARCHIVOS).map((a) => a.archivo))]
  cargando = Promise.all(
    nombres.map(async (nombre) => {
      try {
        const respuesta = await fetch(`${import.meta.env.BASE_URL}sonidos/${nombre}.m4a`)
        if (!respuesta.ok) throw new Error(`no se pudo bajar ${nombre}`)
        sonidos.set(nombre, await contexto.decodeAudioData(await respuesta.arrayBuffer()))
      } catch (error) {
        console.warn('Sonido no disponible, se usará el sintetizado:', nombre, error)
      }
    }),
  ).then(() => undefined)
  return cargando
}

/** Ruido blanco reutilizable: generarlo en cada golpe sería un desperdicio. */
let bufferRuido: AudioBuffer | null = null
let contextoDelBuffer: AudioContext | null = null

function obtenerRuido(contexto: AudioContext): AudioBuffer {
  if (bufferRuido && contextoDelBuffer === contexto) return bufferRuido
  const duracion = 2
  const buffer = contexto.createBuffer(1, contexto.sampleRate * duracion, contexto.sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1
  bufferRuido = buffer
  contextoDelBuffer = contexto
  return buffer
}

interface OpcionesGolpe {
  cuando: number
  volumen?: number
  acento?: boolean
}

/** Envolvente estándar: sube casi instantáneo y cae. */
function envolvente(
  contexto: AudioContext,
  cuando: number,
  pico: number,
  caida: number,
  ataque = 0.001,
): GainNode {
  const ganancia = contexto.createGain()
  ganancia.gain.setValueAtTime(0.0001, cuando)
  ganancia.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), cuando + ataque)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, cuando + caida)
  return ganancia
}

/** Golpe de ruido filtrado: la base de parches y platillos. */
function ruido(
  contexto: AudioContext,
  cuando: number,
  opciones: {
    pico: number
    caida: number
    tipoFiltro: BiquadFilterType
    frecuencia: number
    q?: number
    ataque?: number
  },
): AudioNode {
  const fuente = contexto.createBufferSource()
  fuente.buffer = obtenerRuido(contexto)
  // Empezamos en un punto al azar del ruido para que no suenen dos golpes idénticos.
  const desfase = Math.random() * 1.5

  const filtro = contexto.createBiquadFilter()
  filtro.type = opciones.tipoFiltro
  filtro.frequency.setValueAtTime(opciones.frecuencia, cuando)
  if (opciones.q !== undefined) filtro.Q.setValueAtTime(opciones.q, cuando)

  const ganancia = envolvente(contexto, cuando, opciones.pico, opciones.caida, opciones.ataque)

  fuente.connect(filtro)
  filtro.connect(ganancia)
  fuente.start(cuando, desfase)
  fuente.stop(cuando + opciones.caida + 0.05)
  fuente.onended = () => {
    fuente.disconnect()
    filtro.disconnect()
    ganancia.disconnect()
  }
  return ganancia
}

/** Oscilador con la afinación cayendo: el cuerpo del bombo y los toms. */
function tono(
  contexto: AudioContext,
  cuando: number,
  opciones: {
    desde: number
    hasta: number
    pico: number
    caida: number
    caidaTono?: number
    tipo?: OscillatorType
  },
): AudioNode {
  const oscilador = contexto.createOscillator()
  oscilador.type = opciones.tipo ?? 'sine'
  oscilador.frequency.setValueAtTime(opciones.desde, cuando)
  oscilador.frequency.exponentialRampToValueAtTime(
    opciones.hasta,
    cuando + (opciones.caidaTono ?? opciones.caida * 0.4),
  )

  const ganancia = envolvente(contexto, cuando, opciones.pico, opciones.caida)
  oscilador.connect(ganancia)
  oscilador.start(cuando)
  oscilador.stop(cuando + opciones.caida + 0.05)
  oscilador.onended = () => {
    oscilador.disconnect()
    ganancia.disconnect()
  }
  return ganancia
}

/**
 * Programa el golpe de una pieza para que suene en el instante indicado.
 * Devuelve los nodos creados, para poder callarlos si hace falta.
 */
export function programarPieza(
  contexto: AudioContext,
  pieza: Pieza,
  opciones: OpcionesGolpe,
): AudioNode[] {
  const receta = ARCHIVOS[pieza]
  const sonido = sonidos.get(receta.archivo)
  if (sonido) return reproducirSample(contexto, sonido, receta.velocidad ?? 1, opciones)
  return sintetizarPieza(contexto, pieza, opciones)
}

/** Reproduce la grabación de una pieza. */
function reproducirSample(
  contexto: AudioContext,
  sonido: AudioBuffer,
  velocidad: number,
  { cuando, volumen = 1, acento = false }: OpcionesGolpe,
): AudioNode[] {
  const fuente = contexto.createBufferSource()
  fuente.buffer = sonido
  // Un pelín de variación de afinación en cada golpe: sin esto, repetir la
  // misma nota suena a máquina.
  fuente.playbackRate.value = velocidad * (1 + (Math.random() - 0.5) * 0.02)

  const ganancia = contexto.createGain()
  ganancia.gain.value = volumen * (acento ? 1.3 : 1)

  fuente.connect(ganancia)
  ganancia.connect(obtenerSalidaBateria())
  fuente.start(cuando)
  fuente.onended = () => {
    fuente.disconnect()
    ganancia.disconnect()
  }
  return [ganancia]
}

/** Batería sintetizada de respaldo, por si no se pudieron cargar los sonidos. */
function sintetizarPieza(
  contexto: AudioContext,
  pieza: Pieza,
  { cuando, volumen = 1, acento = false }: OpcionesGolpe,
): AudioNode[] {
  const salida = obtenerSalidaBateria()
  const fuerza = volumen * (acento ? 1.35 : 1)
  const nodos: AudioNode[] = []
  const soltar = (...partes: AudioNode[]): void => {
    for (const parte of partes) {
      parte.connect(salida)
      nodos.push(parte)
    }
  }

  switch (pieza) {
    case 'bombo':
      // Cuerpo grave que cae rápido + un chasquido del parche.
      soltar(
        tono(contexto, cuando, { desde: 150, hasta: 46, pico: 1 * fuerza, caida: 0.38, caidaTono: 0.06 }),
        ruido(contexto, cuando, { pico: 0.28 * fuerza, caida: 0.03, tipoFiltro: 'lowpass', frecuencia: 2200 }),
      )
      break

    case 'tarola':
      // Dos tonos cortos (el parche y la caja) más el ruido de la bordonera.
      soltar(
        tono(contexto, cuando, { desde: 330, hasta: 180, pico: 0.38 * fuerza, caida: 0.11, tipo: 'triangle' }),
        tono(contexto, cuando, { desde: 185, hasta: 120, pico: 0.3 * fuerza, caida: 0.09, tipo: 'triangle' }),
        ruido(contexto, cuando, { pico: 0.55 * fuerza, caida: 0.19, tipoFiltro: 'bandpass', frecuencia: 2400, q: 0.6 }),
      )
      break

    case 'tarolaAro':
      // Rimshot: lo mismo pero más brillante y con más golpe.
      soltar(
        tono(contexto, cuando, { desde: 420, hasta: 200, pico: 0.5 * fuerza, caida: 0.12, tipo: 'triangle' }),
        ruido(contexto, cuando, { pico: 0.7 * fuerza, caida: 0.22, tipoFiltro: 'bandpass', frecuencia: 3200, q: 0.5 }),
        ruido(contexto, cuando, { pico: 0.5 * fuerza, caida: 0.02, tipoFiltro: 'highpass', frecuencia: 5000 }),
      )
      break

    case 'aro':
      // Cross-stick: madera seca, casi sin cuerpo.
      soltar(
        tono(contexto, cuando, { desde: 800, hasta: 380, pico: 0.42 * fuerza, caida: 0.05, tipo: 'square' }),
        ruido(contexto, cuando, { pico: 0.3 * fuerza, caida: 0.035, tipoFiltro: 'bandpass', frecuencia: 1700, q: 2 }),
      )
      break

    case 'hiHatCerrado':
      soltar(
        ruido(contexto, cuando, { pico: 0.33 * fuerza, caida: 0.045, tipoFiltro: 'highpass', frecuencia: 7000 }),
      )
      break

    case 'hiHatAbierto':
      soltar(
        ruido(contexto, cuando, { pico: 0.32 * fuerza, caida: 0.38, tipoFiltro: 'highpass', frecuencia: 6200 }),
      )
      break

    case 'hiHatPedal':
      // El pie cerrando los platos: más corto y más oscuro.
      soltar(
        ruido(contexto, cuando, { pico: 0.26 * fuerza, caida: 0.07, tipoFiltro: 'bandpass', frecuencia: 5200, q: 0.8 }),
      )
      break

    case 'ride':
      // El "ping" de la baqueta sobre el plato, con la cola metálica detrás.
      soltar(
        tono(contexto, cuando, { desde: 1100, hasta: 850, pico: 0.22 * fuerza, caida: 0.11, tipo: 'square' }),
        ruido(contexto, cuando, { pico: 0.15 * fuerza, caida: 0.75, tipoFiltro: 'highpass', frecuencia: 5500 }),
      )
      break

    case 'campana':
      soltar(
        tono(contexto, cuando, { desde: 1580, hasta: 1500, pico: 0.3 * fuerza, caida: 0.45, tipo: 'square' }),
        tono(contexto, cuando, { desde: 2370, hasta: 2300, pico: 0.16 * fuerza, caida: 0.3, tipo: 'square' }),
        ruido(contexto, cuando, { pico: 0.09 * fuerza, caida: 0.4, tipoFiltro: 'highpass', frecuencia: 6500 }),
      )
      break

    case 'crash':
      // Ataque menos seco y cola larga.
      soltar(
        ruido(contexto, cuando, {
          pico: 0.42 * fuerza,
          caida: 1.6,
          tipoFiltro: 'highpass',
          frecuencia: 3800,
          ataque: 0.006,
        }),
      )
      break

    case 'tomAgudo':
      soltar(
        tono(contexto, cuando, { desde: 300, hasta: 180, pico: 0.72 * fuerza, caida: 0.34 }),
        ruido(contexto, cuando, { pico: 0.16 * fuerza, caida: 0.04, tipoFiltro: 'lowpass', frecuencia: 3000 }),
      )
      break

    case 'tomMedio':
      soltar(
        tono(contexto, cuando, { desde: 225, hasta: 135, pico: 0.75 * fuerza, caida: 0.42 }),
        ruido(contexto, cuando, { pico: 0.16 * fuerza, caida: 0.04, tipoFiltro: 'lowpass', frecuencia: 2600 }),
      )
      break

    case 'tomPiso':
      soltar(
        tono(contexto, cuando, { desde: 155, hasta: 92, pico: 0.8 * fuerza, caida: 0.6 }),
        ruido(contexto, cuando, { pico: 0.15 * fuerza, caida: 0.05, tipoFiltro: 'lowpass', frecuencia: 2000 }),
      )
      break
  }

  return nodos
}

/** Nombre en español de cada pieza, para la leyenda del pentagrama. */
export const NOMBRE_PIEZA: Record<Pieza, string> = {
  bombo: 'Bombo',
  tarola: 'Tarola',
  aro: 'Aro (cross-stick)',
  tarolaAro: 'Tarola con aro (rimshot)',
  hiHatCerrado: 'Hi-hat cerrado',
  hiHatAbierto: 'Hi-hat abierto',
  hiHatPedal: 'Hi-hat con el pie',
  ride: 'Ride',
  campana: 'Campana del ride',
  crash: 'Crash',
  tomAgudo: 'Tom agudo',
  tomMedio: 'Tom medio',
  tomPiso: 'Tom de piso',
}
