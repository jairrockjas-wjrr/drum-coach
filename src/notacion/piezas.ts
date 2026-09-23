// Dónde se escribe cada pieza en el pentagrama de percusión.
//
// Se usa la convención estándar de batería (la misma de los métodos publicados):
// el pentagrama no indica notas graves y agudas, sino piezas del kit.
// Los platillos llevan cabeza de "x" para distinguirlos de los parches.

import type { Pieza } from '../ejercicios/tipos'

export interface SitioEnElPentagrama {
  /** Clave de VexFlow: nota/octava[/cabeza]. */
  clave: string
  /** Dónde cae, explicado en palabras, para la leyenda. */
  donde: string
}

export const SITIO: Record<Pieza, SitioEnElPentagrama> = {
  crash: { clave: 'a/5/x2', donde: 'encima del pentagrama, con x' },
  hiHatCerrado: { clave: 'g/5/x2', donde: 'arriba del todo, con x' },
  hiHatAbierto: { clave: 'g/5/x2', donde: 'igual que el hi-hat, con un círculo encima' },
  ride: { clave: 'f/5/x2', donde: 'en la línea de arriba, con x' },
  campana: { clave: 'f/5/d2', donde: 'línea de arriba, con rombo' },
  tomAgudo: { clave: 'e/5', donde: 'en el espacio de arriba' },
  tomMedio: { clave: 'd/5', donde: 'en la cuarta línea' },
  tarola: { clave: 'c/5', donde: 'en el espacio del medio' },
  aro: { clave: 'c/5/x2', donde: 'espacio del medio, con x' },
  tarolaAro: { clave: 'c/5', donde: 'espacio del medio, con acento' },
  tomPiso: { clave: 'a/4', donde: 'en el segundo espacio' },
  bombo: { clave: 'f/4', donde: 'en el espacio de abajo' },
  hiHatPedal: { clave: 'd/4/x2', donde: 'debajo del pentagrama, con x' },
}

/** Orden en que conviene mostrar la leyenda: de arriba abajo del pentagrama. */
export const ORDEN_LEYENDA: Pieza[] = [
  'crash',
  'hiHatCerrado',
  'hiHatAbierto',
  'ride',
  'campana',
  'tomAgudo',
  'tomMedio',
  'tarola',
  'aro',
  'tarolaAro',
  'tomPiso',
  'bombo',
  'hiHatPedal',
]
