// Batería sintetizada con Web Audio. Sin samples: todo se genera en el momento,
// así la app pesa poco y funciona sin descargar nada.
//
// Cada pieza se arma con dos ingredientes:
//  - Ruido blanco filtrado (parches, platillos, escobillas del sonido).
//  - Osciladores con la afinación cayendo (el "cuerpo" del bombo y los toms).
// Todo se programa con instantes exactos del reloj de audio, igual que el click.

import { obtenerSalidaBateria } from './contexto'
import type { Pieza } from '../ejercicios/tipos'

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
