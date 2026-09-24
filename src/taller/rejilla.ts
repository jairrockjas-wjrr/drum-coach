// Convierte una rejilla de casillas en compases escritos de verdad.
//
// La rejilla es lo que se toca con el dedo: una fila por pieza y dieciséis
// casillas por compás (las semicorcheas). Lo de aquí es lo que traduce eso a
// figuras con su duración correcta, que es lo que hace falta para dibujarlo en
// el pentagrama y para que suene.
//
// Regla de oro: se trabaja tiempo a tiempo (cuatro casillas). Una figura nunca
// cruza de un tiempo al siguiente. Así el compás siempre suma exacto y las
// barras de unión salen agrupadas por tiempo, como se escribe de verdad.

import type { CompasEscrito, Ejercicio, Nota, Pieza } from '../ejercicios/tipos'

/** Casillas por tiempo: las cuatro semicorcheas. */
export const POR_TIEMPO = 4
/** Casillas por compás de 4/4. */
export const POR_COMPAS = POR_TIEMPO * 4

/** Piezas que se tocan con el pie: van en la voz de abajo del pentagrama. */
const DE_PIE: Pieza[] = ['bombo', 'hiHatPedal']

/**
 * Una fila de la rejilla: una pieza y las casillas encendidas.
 * `casillas[i]` es true si en esa semicorchea suena esa pieza.
 */
export interface Fila {
  pieza: Pieza
  casillas: boolean[]
}

/** Lo que el usuario ha dibujado: las filas y cuántos compases tiene. */
export interface Rejilla {
  filas: Fila[]
  compases: number
}

/** Rejilla vacía con esas piezas y esos compases. */
export function rejillaVacia(piezas: Pieza[], compases: number): Rejilla {
  return {
    compases,
    filas: piezas.map((pieza) => ({
      pieza,
      casillas: new Array<boolean>(compases * POR_COMPAS).fill(false),
    })),
  }
}

/**
 * Figura que dura ese número de casillas dentro de un tiempo.
 * 1 = semicorchea, 2 = corchea, 3 = corchea con puntillo, 4 = negra.
 */
function figuraDe(casillas: number): Pick<Nota, 'figura' | 'puntillo'> {
  if (casillas >= 4) return { figura: 'negra' }
  if (casillas === 3) return { figura: 'corchea', puntillo: true }
  if (casillas === 2) return { figura: 'corchea' }
  return { figura: 'semicorchea' }
}

/**
 * Silencios que cubren ese hueco. Uno de tres casillas se escribe con dos
 * figuras (corchea y semicorchea), que es como se escribe de verdad: el
 * silencio de corchea con puntillo casi no se usa y se lee peor.
 */
function silenciosDe(casillas: number): Nota[] {
  if (casillas >= 4) return [{ figura: 'negra', piezas: [] }]
  if (casillas === 3) {
    return [
      { figura: 'corchea', piezas: [] },
      { figura: 'semicorchea', piezas: [] },
    ]
  }
  if (casillas === 2) return [{ figura: 'corchea', piezas: [] }]
  return [{ figura: 'semicorchea', piezas: [] }]
}

/**
 * Convierte un tiempo (cuatro casillas) de una voz en sus figuras.
 *
 * Sin digitación: aquí no se escribe R ni L. En los ejercicios del catálogo
 * sabemos con qué mano va cada golpe porque los escribimos nosotros, pero en
 * una página que estás copiando no hay forma de saberlo, y poner una mano
 * inventada debajo de cada nota es peor que no poner ninguna.
 */
function tiempoAFiguras(golpes: { casilla: number; piezas: Pieza[] }[]): Nota[] {
  if (golpes.length === 0) return silenciosDe(POR_TIEMPO)

  const notas: Nota[] = []

  // Hueco antes del primer golpe.
  if (golpes[0].casilla > 0) notas.push(...silenciosDe(golpes[0].casilla))

  golpes.forEach((golpe, i) => {
    const siguiente = golpes[i + 1]?.casilla ?? POR_TIEMPO
    notas.push({ ...figuraDe(siguiente - golpe.casilla), piezas: golpe.piezas })
  })

  return notas
}

/**
 * La rejilla entera, hecha compases.
 *
 * Las manos y los pies se separan porque en el pentagrama son dos voces con la
 * plica en sentidos opuestos. Lo que cae en la misma casilla suena junto.
 */
export function rejillaACompases(rejilla: Rejilla): CompasEscrito[] {
  const compases: CompasEscrito[] = []

  for (let compas = 0; compas < rejilla.compases; compas++) {
    const manos: Nota[] = []
    const pies: Nota[] = []

    for (let tiempo = 0; tiempo < 4; tiempo++) {
      const base = compas * POR_COMPAS + tiempo * POR_TIEMPO

      for (const voz of ['manos', 'pies'] as const) {
        const golpes: { casilla: number; piezas: Pieza[] }[] = []
        for (let i = 0; i < POR_TIEMPO; i++) {
          const piezas = rejilla.filas
            .filter(
              (fila) =>
                fila.casillas[base + i] && DE_PIE.includes(fila.pieza) === (voz === 'pies'),
            )
            .map((fila) => fila.pieza)
          if (piezas.length > 0) golpes.push({ casilla: i, piezas })
        }

        const figuras = tiempoAFiguras(golpes)
        if (voz === 'manos') manos.push(...figuras)
        else pies.push(...figuras)
      }
    }

    compases.push({ manos, pies })
  }

  return compases
}

/** La rejilla, vista como un ejercicio que se puede dibujar y tocar. */
export function rejillaAEjercicio(
  id: string,
  titulo: string,
  rejilla: Rejilla,
  bpm: number,
): Ejercicio {
  return {
    id,
    titulo,
    estilo: 'lectura',
    nivel: 1,
    compas: { pulsos: 4, figura: 4 },
    bpmSugerido: bpm,
    descripcion: 'Partitura tuya, guardada solo en este teléfono.',
    compases: rejillaACompases(rejilla),
  }
}
