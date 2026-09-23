// Las lecciones de lectura, en orden. Contenido original de la app.
//
// La idea: explicar una sola cosa por lección, con palabras de baterista y no
// de libro de solfeo, enseñarla con un ejemplo que se puede oír, y mandar a
// los ejercicios del catálogo para practicarla de verdad.

import type { Figura, Nota, Pieza } from '../ejercicios/tipos'
import type { Leccion } from './tipos'

// --- Atajos para escribir los ejemplos ---
const nota = (figura: Figura, piezas: Pieza[], extra: Partial<Nota> = {}): Nota => ({
  figura,
  piezas,
  ...extra,
})
const negra = (piezas: Pieza[], extra?: Partial<Nota>) => nota('negra', piezas, extra)
const corchea = (piezas: Pieza[], extra?: Partial<Nota>) => nota('corchea', piezas, extra)
const semi = (piezas: Pieza[], extra?: Partial<Nota>) => nota('semicorchea', piezas, extra)
const tresillo = (piezas: Pieza[], extra?: Partial<Nota>) =>
  nota('corchea', piezas, { ...extra, tresillo: true })
const calla = (figura: Figura): Nota => nota(figura, [])
const veces = (cuantas: number, hacer: (i: number) => Nota): Nota[] =>
  Array.from({ length: cuantas }, (_, i) => hacer(i))
const alternando = (i: number): 'R' | 'L' => (i % 2 === 0 ? 'R' : 'L')

const CUATRO_CUARTOS = { pulsos: 4, figura: 4 } as const

export const LECCIONES: Leccion[] = [
  {
    id: 'pentagrama',
    titulo: '1. El pentagrama de la batería',
    resumen: 'Qué es cada línea y cada espacio, y por qué unas notas llevan x.',
    texto: [
      'Un pentagrama son cinco líneas y los cuatro espacios que quedan entre ellas. En un instrumento de notas, la altura dice si el sonido es grave o agudo. En la batería no: cada línea y cada espacio es una pieza del kit.',
      'Se lee de abajo hacia arriba más o menos como está montada la batería: el bombo abajo del todo, la tarola en el espacio de en medio, los toms por encima, y los platillos arriba.',
      'Los platillos se escriben con una x en vez de una cabeza redonda. Así distingues de un vistazo un golpe de parche de uno de metal.',
      'Y hay un detalle que te va a servir siempre: lo que tocas con las manos lleva la plica (el palito) hacia arriba, y lo que tocas con los pies, hacia abajo. Por eso el bombo y el hi-hat de pie se ven colgando por debajo.',
    ],
    ejemplos: [
      {
        titulo: 'Una pieza por tiempo',
        pie: 'Crash, hi-hat, tarola y tom agudo con las manos; bombo y hi-hat de pie por debajo.',
        compas: CUATRO_CUARTOS,
        bpm: 60,
        compases: [
          {
            manos: [negra(['crash']), negra(['hiHatCerrado']), negra(['tarola']), negra(['tomAgudo'])],
            pies: [negra(['bombo']), calla('negra'), negra(['hiHatPedal']), calla('negra')],
          },
        ],
      },
    ],
    practica: [],
  },

  {
    id: 'negras',
    titulo: '2. El pulso y las negras',
    resumen: 'Una nota por tiempo. Contar 1, 2, 3, 4 en voz alta.',
    texto: [
      'El pulso es eso que marcas con el pie cuando escuchas una canción. En 4/4 hay cuatro pulsos por compás, y los cuentas 1, 2, 3, 4.',
      'La negra es la figura que dura justo un pulso: una nota, un tiempo. Es la que ves en el ejemplo, una por cada número.',
      'Lo importante desde el primer día: cuenta en voz alta mientras tocas. No es un capricho de profesor, es lo que hace que el pulso deje de depender de la vista y se te meta en el cuerpo.',
      'Debajo de cada nota, la app te escribe el conteo. Léelo mientras suena y verás cómo cuadra.',
    ],
    ejemplos: [
      {
        titulo: 'Cuatro negras',
        pie: 'Una nota por tiempo: 1, 2, 3, 4.',
        compas: CUATRO_CUARTOS,
        bpm: 70,
        compases: [
          { manos: veces(4, (i) => negra(['tarola'], { mano: alternando(i) })), pies: [] },
        ],
      },
    ],
    practica: ['lectura-negras'],
  },

  {
    id: 'silencios',
    titulo: '3. Los silencios',
    resumen: 'El silencio también se escribe, y también hay que contarlo.',
    texto: [
      'En música el silencio no es "no hay nada": es una figura más, con su duración exacta. El silencio de negra dura un pulso, igual que la negra.',
      'El error clásico al empezar es dejar de contar cuando no tocas. No lo hagas: el conteo sigue corriendo, 1, 2, 3, 4, toques o no toques.',
      'En el ejemplo tocas el 1 y el 3, y callas el 2 y el 4. Si lo cuentas en voz alta te va a salir a la primera; si no lo cuentas, se te va a ir.',
    ],
    ejemplos: [
      {
        titulo: 'Tocar y callar',
        pie: 'Suenan el 1 y el 3. El 2 y el 4 se cuentan igual.',
        compas: CUATRO_CUARTOS,
        bpm: 70,
        compases: [
          {
            manos: [
              negra(['tarola'], { mano: 'R' }),
              calla('negra'),
              negra(['tarola'], { mano: 'L' }),
              calla('negra'),
            ],
            pies: [],
          },
        ],
      },
    ],
    practica: ['lectura-negras'],
  },

  {
    id: 'corcheas',
    titulo: '4. Las corcheas',
    resumen: 'Dos notas por tiempo. Aquí aparece la palabra "y".',
    texto: [
      'La corchea dura media negra: entran dos en cada pulso. Se cuentan "1 y 2 y 3 y 4 y", donde el número es el pulso y la "y" cae justo en medio.',
      'Se reconocen porque van unidas por una barra arriba. Esa barra no cambia el sonido: solo agrupa las notas de un mismo tiempo para que el compás se lea de un golpe de vista.',
      'Truco para que salgan parejas: las corcheas se tocan alternando manos, derecha e izquierda. En la partitura verás la R y la L debajo de cada nota.',
    ],
    ejemplos: [
      {
        titulo: 'Ocho corcheas',
        pie: '1 y 2 y 3 y 4 y, alternando manos.',
        compas: CUATRO_CUARTOS,
        bpm: 70,
        compases: [
          { manos: veces(8, (i) => corchea(['tarola'], { mano: alternando(i) })), pies: [] },
        ],
      },
      {
        titulo: 'Negras y corcheas juntas',
        pie: 'El pulso no cambia: lo que cambia es cuántas notas metes dentro.',
        compas: CUATRO_CUARTOS,
        bpm: 70,
        compases: [
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
        ],
      },
    ],
    practica: ['lectura-corcheas'],
  },

  {
    id: 'semicorcheas',
    titulo: '5. Las semicorcheas',
    resumen: 'Cuatro notas por tiempo: el conteo completo, 1 e y a.',
    texto: [
      'La semicorchea dura media corchea: entran cuatro en cada pulso. Se cuentan "1 e y a", y esas cuatro sílabas son la base para leer casi todo el funk y el rock moderno.',
      'Se distinguen de las corcheas porque llevan dos barras arriba en vez de una. Cuantas más barras, más corta es la figura.',
      'Empieza mucho más lento de lo que crees que necesitas. La meta no es que suenen rápidas, es que suenen parejas: si la cuarta llega tarde, el tempo está demasiado alto.',
    ],
    ejemplos: [
      {
        titulo: 'Un tiempo de cada',
        pie: 'Negra, corcheas y semicorcheas seguidas, para oír la diferencia.',
        compas: CUATRO_CUARTOS,
        bpm: 60,
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
        ],
      },
    ],
    practica: ['lectura-semicorcheas'],
  },

  {
    id: 'mezclar',
    titulo: '6. Cambiar de figura sin perder el pulso',
    resumen: 'Lo que de verdad cuesta al leer: los cambios.',
    texto: [
      'Ya sabes leer negras, corcheas y semicorcheas por separado. Lo que cuesta es cambiar de una a otra sin que se mueva el pulso, y eso es justo lo que hace un compás de música de verdad.',
      'La clave está en no leer nota a nota, sino tiempo a tiempo: mira un pulso entero y pregúntate cuántas notas lleva dentro. Una, dos o cuatro.',
      'Y lee siempre un poco adelantado, como cuando lees en voz alta: los ojos van por delante de las manos.',
    ],
    ejemplos: [
      {
        titulo: 'Un compás con de todo',
        pie: 'Cuenta "1 e y a" todo el rato, aunque no toques las cuatro.',
        compas: CUATRO_CUARTOS,
        bpm: 60,
        compases: [
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
        ],
      },
    ],
    practica: ['lectura-mezcla'],
  },

  {
    id: 'tresillos',
    titulo: '7. Los tresillos',
    resumen: 'Tres notas parejas dentro de un solo tiempo.',
    texto: [
      'Hasta ahora los tiempos se partían en dos o en cuatro. El tresillo los parte en tres: tres notas iguales dentro de un pulso.',
      'Se escriben con un corchete y un 3 encima. Ese 3 es el aviso de "aquí caben tres donde normalmente cabrían dos".',
      'Se cuentan "1 la li, 2 la li". Si te cuesta, di la palabra "chocolate" a tiempo constante: son justo tres sílabas por pulso.',
      'Los tresillos son la puerta de entrada al jazz: el ride de swing es, en el fondo, un tresillo al que le falta la nota de en medio.',
    ],
    ejemplos: [
      {
        titulo: 'Cuatro tresillos',
        pie: '1 la li 2 la li 3 la li 4 la li.',
        compas: CUATRO_CUARTOS,
        bpm: 55,
        compases: [
          { manos: veces(12, (i) => tresillo(['tarola'], { mano: alternando(i) })), pies: [] },
        ],
      },
    ],
    practica: ['lectura-tresillos'],
  },

  {
    id: 'swing',
    titulo: '8. El swing',
    resumen: 'Por qué el jazz no se toca recto, y cómo se escribe.',
    texto: [
      'Swinguear es tocar las dos corcheas de cada tiempo desiguales: la primera larga y la segunda corta y tarde. Es lo que hace que el ride suene "chín, chi-kí" en vez de "chin-chin".',
      'De dónde sale: parte el pulso en tres (un tresillo) y quita la nota de en medio. Lo que queda es el swing.',
      'Por eso en esta app el patrón de jazz está escrito con tresillos: así ves exactamente dónde cae cada golpe, en vez de aprenderlo de oído a ciegas.',
      'Y por eso el metrónomo tiene un deslizador de swing y no un interruptor: entre recto y tresillo hay muchos grados, y cambian según el tempo y el estilo.',
    ],
    ejemplos: [
      {
        titulo: 'El ride de swing',
        pie: 'El tresillo con la nota de en medio en silencio: ahí está el swing.',
        compas: CUATRO_CUARTOS,
        bpm: 90,
        compases: [
          {
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
          },
        ],
      },
    ],
    practica: ['jazz-ride-swing'],
  },

  {
    id: 'todo-junto',
    titulo: '9. Todo junto',
    resumen: 'Leer un groove de verdad: manos y pies a la vez.',
    texto: [
      'Hasta aquí has leído una sola voz. Un groove lleva dos: lo que hacen las manos, con las plicas hacia arriba, y lo que hacen los pies, hacia abajo.',
      'Se leen en columna. Todo lo que está alineado en vertical suena a la vez, aunque una nota esté arriba y otra abajo.',
      'Para montarlo, sepáralo: toca solo los pies con el click hasta que salga sin pensar, luego solo las manos, y al final júntalo. En los ajustes de cada ejercicio puedes silenciar una voz u otra para estudiarlo justo así.',
    ],
    ejemplos: [
      {
        titulo: 'El rock de siempre',
        pie: 'Hi-hat en corcheas arriba, tarola en 2 y 4, bombo en 1 y 3 abajo.',
        compas: CUATRO_CUARTOS,
        bpm: 85,
        compases: [
          {
            manos: veces(8, (i) =>
              corchea(i === 2 || i === 6 ? ['hiHatCerrado', 'tarola'] : ['hiHatCerrado']),
            ),
            pies: [negra(['bombo']), calla('negra'), negra(['bombo']), calla('negra')],
          },
        ],
      },
    ],
    practica: ['rock-basico', 'funk-semicorcheas'],
  },
]
