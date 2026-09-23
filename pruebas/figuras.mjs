// Comprueba la tabla de figuras: que lo que dice cada ficha cuadre con los
// ticks de verdad. Si alguien cambia una duración, esto salta.

import assert from 'node:assert/strict'
import { FIGURAS, cuantasEntran } from '../src/notacion/figuras.ts'
import { TICKS } from '../src/ejercicios/tipos.ts'

// Cuántas entran en un compás de 4/4, sabido de memoria.
const ESPERADO = {
  redonda: 1,
  blanca: 2,
  negra: 4,
  corchea: 8,
  semicorchea: 16,
}

for (const ficha of FIGURAS) {
  const entran = cuantasEntran(ficha.figura)
  assert.equal(
    entran,
    ESPERADO[ficha.figura],
    `${ficha.nombre}: deberían entrar ${ESPERADO[ficha.figura]} en un compás y entran ${entran}`,
  )
  assert.ok(Number.isInteger(entran), `${ficha.nombre}: no entra un número redondo en el compás`)
  // El compás tiene que quedar exacto, sin sobras.
  assert.equal(entran * TICKS[ficha.figura], TICKS.negra * 4, `${ficha.nombre}: no llena el compás`)
  assert.ok(ficha.nombreSilencio.startsWith('Silencio de'), `${ficha.nombre}: silencio mal nombrado`)
}

assert.equal(FIGURAS.length, 5, 'faltan o sobran figuras en la tabla')

console.log(`${FIGURAS.length} figuras revisadas: duraciones y silencios cuadran.`)
