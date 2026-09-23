// Validador de ejercicios: comprueba que lo escrito sea música correcta.
// Se ejecuta en cada compilación (pruebas/ejercicios.mjs), así que un
// ejercicio mal escrito nunca llega a la app.

import type { Ejercicio, Nota } from './tipos'
import { PIEZAS_DE_PIE, esSilencio, ticksDeNota, ticksPorCompas } from './tipos'

export interface Problema {
  ejercicio: string
  compas?: number
  voz?: 'manos' | 'pies'
  mensaje: string
}

/** Revisa un ejercicio y devuelve la lista de problemas (vacía si está bien). */
export function revisarEjercicio(ejercicio: Ejercicio): Problema[] {
  const problemas: Problema[] = []
  const anotar = (mensaje: string, compas?: number, voz?: 'manos' | 'pies'): void => {
    problemas.push({ ejercicio: ejercicio.id, compas, voz, mensaje })
  }

  if (ejercicio.compases.length === 0) anotar('no tiene ningún compás')
  if (ejercicio.bpmSugerido < 30 || ejercicio.bpmSugerido > 300) {
    anotar(`el BPM sugerido (${ejercicio.bpmSugerido}) está fuera de 30–300`)
  }

  const esperado = ticksPorCompas(ejercicio.compas)

  ejercicio.compases.forEach((compas, i) => {
    for (const voz of ['manos', 'pies'] as const) {
      const notas = compas[voz]
      const suma = notas.reduce((total, nota) => total + ticksDeNota(nota), 0)

      // Una voz vacía está permitida (por ejemplo un ejercicio solo de manos).
      if (notas.length === 0) continue

      if (suma !== esperado) {
        anotar(
          `suma ${suma} ticks y el compás ${ejercicio.compas.pulsos}/${ejercicio.compas.figura} necesita ${esperado}`,
          i + 1,
          voz,
        )
      }

      revisarTresillos(notas, (mensaje) => anotar(mensaje, i + 1, voz))

      for (const nota of notas) {
        if (esSilencio(nota)) continue
        const pies = nota.piezas.filter((p) => PIEZAS_DE_PIE.includes(p))
        if (voz === 'pies' && pies.length !== nota.piezas.length) {
          anotar('la voz de los pies solo puede llevar bombo o hi-hat de pie', i + 1, voz)
        }
        if (voz === 'manos' && pies.length > 0) {
          anotar('la voz de las manos no puede llevar bombo ni hi-hat de pie', i + 1, voz)
        }
      }
    }
  })

  return problemas
}

/** Los tresillos van de tres en tres: si no, la partitura no se puede dibujar. */
function revisarTresillos(notas: Nota[], anotar: (mensaje: string) => void): void {
  let seguidas = 0
  for (const nota of notas) {
    if (nota.tresillo) {
      seguidas++
    } else {
      if (seguidas % 3 !== 0) anotar(`hay un grupo de ${seguidas} notas de tresillo (deben ir de 3 en 3)`)
      seguidas = 0
    }
  }
  if (seguidas % 3 !== 0) anotar(`hay un grupo de ${seguidas} notas de tresillo (deben ir de 3 en 3)`)
}

/** Revisa una lista completa de ejercicios. */
export function revisarCatalogo(ejercicios: Ejercicio[]): Problema[] {
  const problemas = ejercicios.flatMap(revisarEjercicio)

  const vistos = new Set<string>()
  for (const ejercicio of ejercicios) {
    if (vistos.has(ejercicio.id)) {
      problemas.push({ ejercicio: ejercicio.id, mensaje: 'hay dos ejercicios con el mismo id' })
    }
    vistos.add(ejercicio.id)
  }

  return problemas
}
