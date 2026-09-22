// Tipos del metrónomo.

/** Cuántas notas por pulso: 1 = solo el pulso, 2 = corcheas, 3 = tresillos, etc. */
export type Subdivision = 1 | 2 | 3 | 4 | 6

/**
 * Compás. `pulsos` es cuántos clicks tiene el compás y `figura` qué nota vale
 * cada uno (4 = negra, 8 = corchea).
 *
 * OJO con el BPM: en esta app el BPM siempre son *pulsos* por minuto.
 * En 4/4 el BPM son negras; en 6/8 y 12/8 son corcheas (lo normal para
 * practicar con metrónomo). La pantalla lo avisa.
 */
export interface Compas {
  pulsos: number
  figura: 4 | 8
}

/** Qué tan fuerte suena cada click. */
export type TipoClick = 'acento' | 'medio' | 'pulso' | 'subdivision'

export interface Entrenador {
  activo: boolean
  /** Cuántos BPM sube cada vez. */
  incremento: number
  /** Cada cuántos compases sube. */
  cadaCompases: number
  /** BPM al que se detiene la subida. */
  bpmMeta: number
}

export interface CompasesEnSilencio {
  activo: boolean
  /** Compases con click. */
  sonando: number
  /** Compases mudos (para probar tu tiempo interno). */
  callados: number
}

export interface ConfigMetronomo {
  bpm: number
  compas: Compas
  subdivision: Subdivision
  /**
   * Porcentaje del pulso en el que cae la corchea débil.
   * 50 = recto, 67 ≈ tresillo (swing de jazz). Solo aplica con corcheas.
   */
  swing: number
  /** Modo jazz: el click suena únicamente en los tiempos 2 y 4 (solo en 4/4). */
  soloDosYCuatro: boolean
  acentoEnUno: boolean
  /** Compases de cuenta de entrada antes de empezar (0, 1 o 2). */
  cuentaEntrada: 0 | 1 | 2
  entrenador: Entrenador
  silencio: CompasesEnSilencio
  /** Volumen del click, 0–1. */
  volumen: number
}

/** Cada click programado (suene o no) se avisa a la pantalla con estos datos. */
export interface EventoMetronomo {
  /** Instante exacto del reloj de audio en el que ocurre. */
  cuando: number
  /** 'silencio' = compás mudo o tiempo que no suena en el modo 2 y 4. */
  tipo: TipoClick | 'silencio'
  /** Pulso dentro del compás, empezando en 0. */
  pulso: number
  /** Posición dentro del pulso, empezando en 0. */
  subdivision: number
  /** Compás contado desde que terminó la cuenta de entrada. */
  compas: number
  enCuentaEntrada: boolean
  bpm: number
}

export const CONFIG_POR_DEFECTO: ConfigMetronomo = {
  bpm: 90,
  compas: { pulsos: 4, figura: 4 },
  subdivision: 1,
  swing: 50,
  soloDosYCuatro: false,
  acentoEnUno: true,
  cuentaEntrada: 0,
  entrenador: { activo: false, incremento: 5, cadaCompases: 4, bpmMeta: 120 },
  silencio: { activo: false, sonando: 3, callados: 1 },
  volumen: 0.9,
}

export const BPM_MINIMO = 30
export const BPM_MAXIMO = 300

/** Compases disponibles en la app. */
export const COMPASES: { etiqueta: string; compas: Compas }[] = [
  { etiqueta: '4/4', compas: { pulsos: 4, figura: 4 } },
  { etiqueta: '3/4', compas: { pulsos: 3, figura: 4 } },
  { etiqueta: '5/4', compas: { pulsos: 5, figura: 4 } },
  { etiqueta: '6/8', compas: { pulsos: 6, figura: 8 } },
  { etiqueta: '7/8', compas: { pulsos: 7, figura: 8 } },
  { etiqueta: '12/8', compas: { pulsos: 12, figura: 8 } },
]

export const SUBDIVISIONES: { etiqueta: string; valor: Subdivision }[] = [
  { etiqueta: 'Solo el pulso', valor: 1 },
  { etiqueta: 'Corcheas', valor: 2 },
  { etiqueta: 'Tresillos', valor: 3 },
  { etiqueta: 'Semicorcheas', valor: 4 },
  { etiqueta: 'Seisillos', valor: 6 },
]
