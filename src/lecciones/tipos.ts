// Modelo de las lecciones de lectura.
//
// Una lección explica una idea (las negras, los silencios, el swing…), la
// enseña con un ejemplo que se puede oír, y remata mandándote a los
// ejercicios del catálogo donde se practica de verdad.

import type { CompasEscrito } from '../ejercicios/tipos'
import type { Compas } from '../metronomo/tipos'

/** Un ejemplo dibujado dentro de la lección, que además suena. */
export interface Ejemplo {
  titulo: string
  /** Qué mirar en el ejemplo, en una línea. */
  pie?: string
  compas: Compas
  bpm: number
  compases: CompasEscrito[]
}

export interface Leccion {
  id: string
  titulo: string
  /** De qué va, en una línea, para la lista. */
  resumen: string
  /** La explicación, en párrafos cortos. */
  texto: string[]
  ejemplos: Ejemplo[]
  /**
   * Muestra todas las piezas del kit dibujadas en su sitio del pentagrama,
   * y se puede tocar cada una para oírla.
   */
  leyenda?: boolean
  /** Ids de ejercicios del catálogo para practicar esta lección. */
  practica: string[]
}
