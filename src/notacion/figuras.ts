// Las figuras musicales y sus silencios: cuánto dura cada una y cuántas
// entran en un compás de 4/4.
//
// Aquí solo están los datos. El dibujo lo hace partitura.ts con VexFlow, para
// que esto se pueda leer desde las pruebas sin arrastrar la librería entera.

import type { Figura } from '../ejercicios/tipos'
import { TICKS } from '../ejercicios/tipos'

/** Ticks de un compás de 4/4: cuatro negras. */
const TICKS_COMPAS = TICKS.negra * 4

export interface FichaFigura {
  figura: Figura
  nombre: string
  /** Cuánto dura, dicho en tiempos (pulsos de negra). */
  dura: string
  nombreSilencio: string
}

export const FIGURAS: FichaFigura[] = [
  {
    figura: 'redonda',
    nombre: 'Redonda',
    dura: '4 tiempos',
    nombreSilencio: 'Silencio de redonda',
  },
  {
    figura: 'blanca',
    nombre: 'Blanca',
    dura: '2 tiempos',
    nombreSilencio: 'Silencio de blanca',
  },
  {
    figura: 'negra',
    nombre: 'Negra',
    dura: '1 tiempo',
    nombreSilencio: 'Silencio de negra',
  },
  {
    figura: 'corchea',
    nombre: 'Corchea',
    dura: 'medio tiempo',
    nombreSilencio: 'Silencio de corchea',
  },
  {
    figura: 'semicorchea',
    nombre: 'Semicorchea',
    dura: 'un cuarto de tiempo',
    nombreSilencio: 'Silencio de semicorchea',
  },
]

/** Cuántas de esa figura caben en un compás de 4/4. */
export function cuantasEntran(figura: Figura): number {
  return TICKS_COMPAS / TICKS[figura]
}
