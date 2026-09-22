// Prueba automática de la lógica musical del metrónomo.
// Se ejecuta con: npm run prueba:logica
// No necesita navegador: comprueba las funciones puras del motor.

import assert from 'node:assert/strict'
import { fraccionesDelPulso, tipoDeClick } from '../src/metronomo/patron.ts'
import { CONFIG_POR_DEFECTO, COMPASES, SUBDIVISIONES } from '../src/metronomo/tipos.ts'

let pruebas = 0
function probar(nombre, fn) {
  fn()
  pruebas++
  console.log('  ✓', nombre)
}

const config = (extra) => ({ ...CONFIG_POR_DEFECTO, ...extra })

console.log('Subdivisiones')

probar('cada subdivisión reparte el pulso en partes iguales', () => {
  for (const { valor } of SUBDIVISIONES) {
    const fr = fraccionesDelPulso(valor, 50)
    assert.equal(fr.length, valor, `${valor} notas por pulso`)
    assert.equal(fr[0], 0, 'la primera cae justo en el pulso')
    for (let i = 1; i < fr.length; i++) {
      // Estrictamente crecientes y siempre dentro del pulso.
      assert.ok(fr[i] > fr[i - 1] && fr[i] < 1)
      assert.ok(Math.abs(fr[i] - fr[i - 1] - 1 / valor) < 1e-12, 'partes iguales')
    }
  }
})

probar('el swing solo corre la segunda corchea', () => {
  assert.deepEqual(fraccionesDelPulso(2, 50), [0, 0.5], 'recto')
  assert.deepEqual(fraccionesDelPulso(2, 67), [0, 0.67], 'swing de jazz')
  // Con tresillos o semicorcheas el swing no debe alterar nada.
  assert.deepEqual(fraccionesDelPulso(3, 67), [0, 1 / 3, 2 / 3])
  assert.deepEqual(fraccionesDelPulso(4, 67), [0, 0.25, 0.5, 0.75])
})

probar('el tresillo de swing cae exactamente en 2/3 del pulso', () => {
  // 67 % es la aproximación que usa la app; el tresillo exacto es 66,67 %.
  const [, segunda] = fraccionesDelPulso(2, 67)
  assert.ok(Math.abs(segunda - 2 / 3) < 0.005, 'a menos de 3 ms a 120 BPM')
})

console.log('Acentos por compás')

probar('en 4/4 el acento va en el 1 y el resto son pulsos', () => {
  const c = config()
  assert.equal(tipoDeClick(c, 0, 0, false), 'acento')
  for (const pulso of [1, 2, 3]) assert.equal(tipoDeClick(c, pulso, 0, false), 'pulso')
})

probar('en 6/8 hay acento medio en el cuarto pulso', () => {
  const c = config({ compas: { pulsos: 6, figura: 8 } })
  assert.equal(tipoDeClick(c, 0, 0, false), 'acento')
  assert.equal(tipoDeClick(c, 3, 0, false), 'medio')
  for (const pulso of [1, 2, 4, 5]) assert.equal(tipoDeClick(c, pulso, 0, false), 'pulso')
})

probar('en 12/8 los acentos medios caen en 4, 7 y 10', () => {
  const c = config({ compas: { pulsos: 12, figura: 8 } })
  assert.equal(tipoDeClick(c, 0, 0, false), 'acento')
  for (const pulso of [3, 6, 9]) assert.equal(tipoDeClick(c, pulso, 0, false), 'medio')
})

probar('en 7/8 solo se acentúa el 1 (no es compás compuesto)', () => {
  const c = config({ compas: { pulsos: 7, figura: 8 } })
  assert.equal(tipoDeClick(c, 0, 0, false), 'acento')
  for (let pulso = 1; pulso < 7; pulso++) assert.equal(tipoDeClick(c, pulso, 0, false), 'pulso')
})

probar('sin acento en el 1, todos los pulsos suenan igual', () => {
  const c = config({ acentoEnUno: false })
  for (let pulso = 0; pulso < 4; pulso++) assert.equal(tipoDeClick(c, pulso, 0, false), 'pulso')
})

console.log('Modos especiales')

probar('el modo jazz suena solo en 2 y 4, sin subdivisiones', () => {
  const c = config({ soloDosYCuatro: true, subdivision: 2 })
  assert.equal(tipoDeClick(c, 0, 0, false), null, 'el 1 calla')
  assert.equal(tipoDeClick(c, 1, 0, false), 'pulso', 'suena el 2')
  assert.equal(tipoDeClick(c, 2, 0, false), null, 'el 3 calla')
  assert.equal(tipoDeClick(c, 3, 0, false), 'pulso', 'suena el 4')
  assert.equal(tipoDeClick(c, 1, 1, false), null, 'sin corcheas de por medio')
})

probar('la cuenta de entrada marca solo los pulsos', () => {
  const c = config({ subdivision: 4, soloDosYCuatro: true })
  assert.equal(tipoDeClick(c, 0, 0, true), 'acento')
  assert.equal(tipoDeClick(c, 2, 0, true), 'pulso', 'en la cuenta suenan todos los pulsos')
  assert.equal(tipoDeClick(c, 0, 1, true), null, 'sin subdivisiones en la cuenta')
})

probar('las subdivisiones suenan más suaves que el pulso', () => {
  const c = config({ subdivision: 4 })
  assert.equal(tipoDeClick(c, 0, 0, false), 'acento')
  for (const s of [1, 2, 3]) assert.equal(tipoDeClick(c, s === 0 ? 0 : 1, s, false), 'subdivision')
})

console.log('Compases disponibles')

probar('todos los compases de la app son coherentes', () => {
  for (const { etiqueta, compas } of COMPASES) {
    const [arriba, abajo] = etiqueta.split('/').map(Number)
    assert.equal(compas.pulsos, arriba, `${etiqueta}: número de pulsos`)
    assert.equal(compas.figura, abajo, `${etiqueta}: figura del pulso`)
  }
})

console.log(`\n${pruebas} pruebas pasaron.`)
