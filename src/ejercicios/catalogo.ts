// Catálogo de ejercicios. Todo el contenido es original de esta app:
// no se copia de libros de método ni de otras aplicaciones.
//
// Cada compás debe sumar exactamente su duración. Eso no se comprueba a ojo:
// lo revisa el validador en cada compilación (pruebas/ejercicios.mjs).

import type { Ejercicio, Figura, Mano, Nota, Pieza } from './tipos'

// --- Atajos para escribir los ejercicios sin repetir tanto ---
const nota = (figura: Figura, piezas: Pieza[], extra: Partial<Nota> = {}): Nota => ({
  figura,
  piezas,
  ...extra,
})

const negra = (piezas: Pieza[], extra?: Partial<Nota>) => nota('negra', piezas, extra)
const corchea = (piezas: Pieza[], extra?: Partial<Nota>) => nota('corchea', piezas, extra)
const semi = (piezas: Pieza[], extra?: Partial<Nota>) => nota('semicorchea', piezas, extra)
/** Corchea de tresillo: tres de estas llenan un pulso. */
const tresillo = (piezas: Pieza[], extra?: Partial<Nota>) =>
  nota('corchea', piezas, { ...extra, tresillo: true })
const calla = (figura: Figura): Nota => nota(figura, [])

/** Repite una nota varias veces. */
const veces = (cuantas: number, hacer: (i: number) => Nota): Nota[] =>
  Array.from({ length: cuantas }, (_, i) => hacer(i))

/** Alterna manos: R L R L… */
const alternando = (i: number): Mano => (i % 2 === 0 ? 'R' : 'L')

const CUATRO_CUARTOS = { pulsos: 4, figura: 4 } as const

export const EJERCICIOS: Ejercicio[] = [
  // ------------------------------------------------------------------
  {
    id: 'lectura-negras',
    titulo: 'Negras y silencios',
    estilo: 'lectura',
    nivel: 1,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 70,
    descripcion: 'El primer paso: una nota por tiempo y aprender a contar los silencios.',
    consejo: 'Cuenta 1-2-3-4 en voz alta, también en los silencios.',
    compases: [
      { manos: veces(4, (i) => negra(['tarola'], { mano: alternando(i) })), pies: [] },
      {
        manos: [negra(['tarola'], { mano: 'R' }), calla('negra'), negra(['tarola'], { mano: 'R' }), calla('negra')],
        pies: [],
      },
      {
        manos: [
          negra(['tarola'], { mano: 'R' }),
          negra(['tarola'], { mano: 'L' }),
          calla('negra'),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [calla('negra'), negra(['tarola'], { mano: 'R' }), negra(['tarola'], { mano: 'L' }), calla('negra')],
        pies: [],
      },
    ],
  },

  // ------------------------------------------------------------------
  {
    id: 'lectura-corcheas',
    titulo: 'Corcheas: 1 y 2 y',
    estilo: 'lectura',
    nivel: 1,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 70,
    descripcion: 'Dos notas por tiempo, alternando manos. Aquí entra la palabra "y".',
    consejo: 'Cuenta "1 y 2 y 3 y 4 y" y mantén las manos parejas.',
    compases: [
      { manos: veces(8, (i) => corchea(['tarola'], { mano: alternando(i) })), pies: [] },
      {
        manos: [
          negra(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          negra(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
        ],
        pies: [],
      },
      {
        manos: [
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          negra(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [
          corchea(['tarola'], { mano: 'R' }),
          calla('corchea'),
          corchea(['tarola'], { mano: 'L' }),
          calla('corchea'),
          negra(['tarola'], { mano: 'R' }),
          negra(['tarola'], { mano: 'L' }),
        ],
        pies: [],
      },
    ],
  },

  // ------------------------------------------------------------------
  {
    id: 'lectura-semicorcheas',
    titulo: 'Semicorcheas: 1 e y a',
    estilo: 'lectura',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 60,
    descripcion: 'Cuatro notas por tiempo. El conteo completo: 1 e y a.',
    consejo: 'Empieza lento de verdad. La parejura importa más que la velocidad.',
    compases: [
      { manos: veces(16, (i) => semi(['tarola'], { mano: alternando(i) })), pies: [] },
      {
        manos: [
          negra(['tarola'], { mano: 'R' }),
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
        ],
        pies: [],
      },
      {
        manos: [
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [
          ...veces(8, (i) => semi(['tarola'], { mano: alternando(i) })),
          ...veces(4, (i) => corchea(['tarola'], { mano: alternando(i) })),
        ],
        pies: [],
      },
    ],
  },

  // ------------------------------------------------------------------
  {
    id: 'lectura-tresillos',
    titulo: 'Tresillos',
    estilo: 'lectura',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 60,
    descripcion: 'Tres notas parejas dentro de un solo tiempo. La puerta de entrada al jazz.',
    consejo: 'Cuenta "1 la li 2 la li". Ninguna de las tres debe sonar más fuerte por accidente.',
    compases: [
      { manos: veces(12, (i) => tresillo(['tarola'], { mano: alternando(i) })), pies: [] },
      {
        manos: [
          ...veces(3, (i) => tresillo(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
          ...veces(3, (i) => tresillo(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [
          ...veces(3, () => tresillo(['tarola'], { mano: 'R' })),
          ...veces(3, () => tresillo(['tarola'], { mano: 'L' })),
          ...veces(3, () => tresillo(['tarola'], { mano: 'R' })),
          ...veces(3, () => tresillo(['tarola'], { mano: 'L' })),
        ],
        pies: [],
      },
      {
        manos: [
          ...veces(3, (i) => tresillo(['tarola'], { mano: alternando(i) })),
          ...veces(3, (i) => tresillo(['tarola'], { mano: alternando(i + 1) })),
          negra(['tarola'], { mano: 'R' }),
          negra(['tarola'], { mano: 'L' }),
        ],
        pies: [],
      },
    ],
  },

  // ------------------------------------------------------------------
  {
    id: 'rock-basico',
    titulo: 'Rock básico',
    estilo: 'rock',
    nivel: 1,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 85,
    descripcion: 'El groove de siempre: hi-hat en corcheas, tarola en 2 y 4, bombo en 1 y 3.',
    consejo: 'Que el hi-hat suene parejo; la tarola manda.',
    compases: Array.from({ length: 2 }, () => ({
      manos: veces(8, (i) =>
        corchea(i === 2 || i === 6 ? ['hiHatCerrado', 'tarola'] : ['hiHatCerrado']),
      ),
      pies: [negra(['bombo']), calla('negra'), negra(['bombo']), calla('negra')],
    })),
  },

  // ------------------------------------------------------------------
  {
    id: 'rock-bombo-sincopado',
    titulo: 'Rock con bombo sincopado',
    estilo: 'rock',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 85,
    descripcion: 'Mismo hi-hat y tarola, pero el bombo se mete en el "y" del 3.',
    consejo: 'Si te pierdes, toca solo los pies con el click hasta que salga solo.',
    compases: Array.from({ length: 2 }, () => ({
      manos: veces(8, (i) =>
        corchea(i === 2 || i === 6 ? ['hiHatCerrado', 'tarola'] : ['hiHatCerrado']),
      ),
      pies: [
        negra(['bombo']),
        calla('negra'),
        corchea(['bombo']),
        corchea([]),
        calla('negra'),
      ],
    })),
  },

  // ------------------------------------------------------------------
  {
    id: 'funk-semicorcheas',
    titulo: 'Funk en semicorcheas',
    estilo: 'funk',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 75,
    descripcion: 'Hi-hat en semicorcheas con una mano, tarola en 2 y 4 y bombo repartido.',
    consejo: 'Mantén la muñeca suelta: son 16 golpes por compás.',
    compases: Array.from({ length: 2 }, () => ({
      manos: veces(16, (i) =>
        semi(i === 4 || i === 12 ? ['hiHatCerrado', 'tarola'] : ['hiHatCerrado']),
      ),
      pies: [
        corchea(['bombo']),
        corchea([]),
        corchea([]),
        corchea(['bombo']),
        corchea([]),
        corchea(['bombo']),
        corchea([]),
        corchea([]),
      ],
    })),
  },

  // ------------------------------------------------------------------
  {
    id: 'jazz-ride-swing',
    titulo: 'Ride de swing con hi-hat en 2 y 4',
    estilo: 'jazz',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 100,
    descripcion: 'El patrón base del jazz: ride "chín, chi-kí" y el pie izquierdo en 2 y 4.',
    consejo: 'El hi-hat con el pie debe sonar seco y a tiempo: es tu metrónomo interno.',
    compases: Array.from({ length: 2 }, () => ({
      // Cada tiempo par lleva la "nota de salto" en el tercer tresillo.
      manos: [
        negra(['ride']),
        tresillo(['ride']),
        tresillo([]),
        tresillo(['ride']),
        negra(['ride']),
        tresillo(['ride']),
        tresillo([]),
        tresillo(['ride']),
      ],
      pies: [calla('negra'), negra(['hiHatPedal']), calla('negra'), negra(['hiHatPedal'])],
    })),
  },

  // ------------------------------------------------------------------
  {
    id: 'coordinacion-manos-pies',
    titulo: 'Manos y pies alternados',
    estilo: 'coordinacion',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 70,
    descripcion: 'Una mano, un pie, una mano, un pie. La base para mover el kit completo.',
    consejo: 'Que el golpe del pie suene igual de fuerte que el de la mano.',
    compases: [
      {
        manos: veces(4, () => negra(['tarola'], { mano: 'R' })),
        pies: Array.from({ length: 4 }, () => [calla('corchea'), corchea(['bombo'])]).flat(),
      },
      {
        manos: veces(4, (i) => negra(['tarola'], { mano: alternando(i) })),
        pies: Array.from({ length: 4 }, () => [calla('corchea'), corchea(['bombo'])]).flat(),
      },
    ],
  },

  // ------------------------------------------------------------------
  {
    id: 'doble-pedal-corcheas',
    titulo: 'Doble pedal: corcheas continuas',
    estilo: 'metal',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 80,
    descripcion: 'Pies en corcheas continuas con las manos marcando el pulso. El primer paso del doble pedal.',
    consejo: 'Empieza guiando con el pie derecho; cuando salga, empieza con el izquierdo.',
    compases: Array.from({ length: 2 }, () => ({
      manos: veces(4, () => negra(['hiHatCerrado'])),
      pies: veces(8, () => corchea(['bombo'])),
    })),
  },

  // ------------------------------------------------------------------
  {
    id: 'lectura-mezcla',
    titulo: 'Mezcla: negras, corcheas y semicorcheas',
    estilo: 'lectura',
    nivel: 2,
    compas: CUATRO_CUARTOS,
    bpmSugerido: 65,
    descripcion: 'Cambiar de figura sin perder el pulso, que es lo que cuesta al leer.',
    consejo: 'Lee un compás adelantado, como cuando lees en voz alta.',
    compases: [
      {
        manos: [
          negra(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          negra(['tarola'], { mano: 'R' }),
        ],
        pies: [],
      },
      {
        manos: [
          corchea(['tarola'], { mano: 'R' }),
          corchea(['tarola'], { mano: 'L' }),
          ...veces(4, (i) => semi(['tarola'], { mano: alternando(i) })),
          negra(['tarola'], { mano: 'R' }),
          calla('negra'),
        ],
        pies: [],
      },
      {
        manos: [negra(['tarola'], { mano: 'R' }), calla('negra'), negra(['tarola'], { mano: 'L' }), calla('negra')],
        pies: [],
      },
    ],
  },
]
