// Revisa que TODOS los ejercicios del catálogo sean musicalmente correctos.
// Se ejecuta con: npm run prueba:ejercicios (y en cada compilación).

import assert from 'node:assert/strict'
import { EJERCICIOS } from '../src/ejercicios/catalogo.ts'
import { revisarCatalogo } from '../src/ejercicios/validador.ts'
import { ticksDeNota, ticksPorCompas } from '../src/ejercicios/tipos.ts'

const problemas = revisarCatalogo(EJERCICIOS)

if (problemas.length > 0) {
  console.error('\nEjercicios mal escritos:\n')
  for (const p of problemas) {
    const donde = p.compas ? ` (compás ${p.compas}, ${p.voz})` : ''
    console.error(`  ✗ ${p.ejercicio}${donde}: ${p.mensaje}`)
  }
  console.error('')
  process.exit(1)
}

// Además del validador, comprobamos a mano un par de cosas que deben cumplirse siempre.
assert.ok(EJERCICIOS.length >= 8, 'debe haber al menos 8 ejercicios')

for (const ejercicio of EJERCICIOS) {
  assert.ok(ejercicio.titulo.length > 0, `${ejercicio.id}: falta el título`)
  assert.ok(ejercicio.descripcion.length > 0, `${ejercicio.id}: falta la descripción`)
  const esperado = ticksPorCompas(ejercicio.compas)
  for (const compas of ejercicio.compases) {
    for (const voz of ['manos', 'pies']) {
      if (compas[voz].length === 0) continue
      const suma = compas[voz].reduce((t, n) => t + ticksDeNota(n), 0)
      assert.equal(suma, esperado, `${ejercicio.id}: un compás de ${voz} no cuadra`)
      // Ninguna duración puede salir con decimales: rompería el reloj.
      for (const nota of compas[voz]) {
        assert.ok(Number.isInteger(ticksDeNota(nota)), `${ejercicio.id}: duración con decimales`)
      }
    }
  }
}

console.log(`${EJERCICIOS.length} ejercicios revisados: todos los compases cuadran.`)
