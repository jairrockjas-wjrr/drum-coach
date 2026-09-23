// Revisa las lecciones de lectura: que los ejemplos sean música correcta y que
// los ejercicios a los que mandan existan de verdad.
// Se ejecuta con: npm run prueba:lecciones (y en cada compilación).

import assert from 'node:assert/strict'
import { LECCIONES } from '../src/lecciones/catalogo.ts'
import { EJERCICIOS } from '../src/ejercicios/catalogo.ts'
import { revisarEjercicio } from '../src/ejercicios/validador.ts'

const problemas = []

const vistos = new Set()
for (const leccion of LECCIONES) {
  if (vistos.has(leccion.id)) problemas.push(`${leccion.id}: id repetido`)
  vistos.add(leccion.id)

  assert.ok(leccion.titulo.length > 0, `${leccion.id}: falta el título`)
  assert.ok(leccion.resumen.length > 0, `${leccion.id}: falta el resumen`)
  assert.ok(leccion.texto.length >= 2, `${leccion.id}: la explicación es demasiado corta`)

  // Los ejemplos se revisan con el mismo validador que los ejercicios.
  leccion.ejemplos.forEach((ejemplo, i) => {
    const comoEjercicio = {
      id: `${leccion.id}-ejemplo-${i + 1}`,
      titulo: ejemplo.titulo,
      estilo: 'lectura',
      nivel: 1,
      compas: ejemplo.compas,
      bpmSugerido: ejemplo.bpm,
      descripcion: ejemplo.pie ?? ejemplo.titulo,
      compases: ejemplo.compases,
    }
    for (const problema of revisarEjercicio(comoEjercicio)) {
      const donde = problema.compas ? ` (compás ${problema.compas}, ${problema.voz})` : ''
      problemas.push(`${problema.ejercicio}${donde}: ${problema.mensaje}`)
    }
  })

  // Los ejercicios de práctica tienen que existir.
  for (const id of leccion.practica) {
    if (!EJERCICIOS.some((e) => e.id === id)) {
      problemas.push(`${leccion.id}: manda al ejercicio "${id}", que no existe`)
    }
  }
}

// Y al revés: ya no hay lista suelta de ejercicios, así que uno que no cuelgue
// de ninguna lección se queda sin forma de llegar a él.
const usados = new Set(LECCIONES.flatMap((l) => l.practica))
for (const ejercicio of EJERCICIOS) {
  if (!usados.has(ejercicio.id)) {
    problemas.push(`el ejercicio "${ejercicio.id}" no aparece en ninguna lección: no hay cómo llegar a él`)
  }
}

if (problemas.length > 0) {
  console.error('\nLecciones con problemas:\n')
  for (const p of problemas) console.error('  ✗ ' + p)
  console.error('')
  process.exit(1)
}

const ejemplos = LECCIONES.reduce((t, l) => t + l.ejemplos.length, 0)
console.log(`${LECCIONES.length} lecciones y ${ejemplos} ejemplos revisados: todo cuadra.`)
