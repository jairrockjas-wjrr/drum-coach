// Modelo de datos de los ejercicios.
//
// Las duraciones se miden en "ticks" (números enteros) en vez de fracciones,
// para que la suma de cada compás sea exacta y no dependa de decimales:
// una negra son 24 ticks, una corchea 12, una semicorchea 6.
// Así un tresillo de corcheas (8 ticks cada una) suma exactamente una negra.

import type { Compas } from '../metronomo/tipos'

/** Piezas del kit que la app sabe sonar y escribir en el pentagrama. */
export type Pieza =
  | 'bombo'
  | 'tarola'
  | 'aro' // cross-stick: baqueta apoyada en el parche, golpeando el aro
  | 'tarolaAro' // rimshot: parche y aro a la vez
  | 'hiHatCerrado'
  | 'hiHatAbierto'
  | 'hiHatPedal'
  | 'ride'
  | 'campana' // campana del ride
  | 'crash'
  | 'tomAgudo'
  | 'tomMedio'
  | 'tomPiso'

/** Qué mano o pie toca la nota. */
export type Mano = 'R' | 'L'

export type Figura = 'redonda' | 'blanca' | 'negra' | 'corchea' | 'semicorchea' | 'fusa'

/** Duración de cada figura en ticks. */
export const TICKS: Record<Figura, number> = {
  redonda: 96,
  blanca: 48,
  negra: 24,
  corchea: 12,
  semicorchea: 6,
  fusa: 3,
}

export interface Nota {
  figura: Figura
  /** Parte de un grupo de tresillo: dura dos tercios de lo normal. */
  tresillo?: boolean
  /** Puntillo: dura una vez y media. */
  puntillo?: boolean
  /** Piezas que suenan juntas (bombo + crash, por ejemplo). Vacío = silencio. */
  piezas: Pieza[]
  /** Mano que toca, para el sticking escrito debajo. */
  mano?: Mano
  acento?: boolean
}

/** Un compás tiene dos voces: lo que hacen las manos y lo que hacen los pies. */
export interface CompasEscrito {
  manos: Nota[]
  pies: Nota[]
}

export type Estilo =
  | 'lectura'
  | 'rock'
  | 'funk'
  | 'jazz'
  | 'blues'
  | 'latino'
  | 'metal'
  | 'coordinacion'
  | 'rudimentos'

export interface Ejercicio {
  id: string
  titulo: string
  estilo: Estilo
  /** 1 = fácil, 2 = intermedio, 3 = difícil. */
  nivel: 1 | 2 | 3
  compas: Compas
  bpmSugerido: number
  /** Para qué sirve, en una línea. */
  descripcion: string
  /** Consejo de práctica opcional. */
  consejo?: string
  compases: CompasEscrito[]
}

/** Duración de una nota en ticks, ya contando tresillo y puntillo. */
export function ticksDeNota(nota: Nota): number {
  let ticks = TICKS[nota.figura]
  if (nota.puntillo) ticks = (ticks * 3) / 2
  if (nota.tresillo) ticks = (ticks * 2) / 3
  return ticks
}

/** Cuántos ticks dura un pulso del compás (una negra en 4/4, una corchea en 6/8). */
export const ticksPorPulso = (compas: Compas): number => (compas.figura === 4 ? 24 : 12)

/** Cuántos ticks debe sumar un compás completo. */
export const ticksPorCompas = (compas: Compas): number => compas.pulsos * ticksPorPulso(compas)

/** Es un silencio cuando no suena ninguna pieza. */
export const esSilencio = (nota: Nota): boolean => nota.piezas.length === 0

/** Piezas que se tocan con los pies (van con la plica hacia abajo). */
export const PIEZAS_DE_PIE: Pieza[] = ['bombo', 'hiHatPedal']
