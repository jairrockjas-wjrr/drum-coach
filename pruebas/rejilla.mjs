// La rejilla tiene que producir compases que sumen exactos SIEMPRE, salga lo
// que salga de los dedos del usuario. Se prueba con rejillas al azar: si hay
// una combinación que descuadra, aquí sale.

import assert from 'node:assert/strict'
import { rejillaACompases, rejillaVacia, POR_COMPAS } from '../src/taller/rejilla.ts'
import { ticksDeNota, TICKS } from '../src/ejercicios/tipos.ts'
import { revisarEjercicio } from '../src/ejercicios/validador.ts'

const TICKS_COMPAS = TICKS.negra * 4
const PIEZAS = ['hiHatCerrado', 'tarola', 'tomAgudo', 'bombo', 'hiHatPedal']

// Azar con semilla, para que un fallo se pueda repetir.
let estado = 20260923
const azar = () => {
  estado = (estado * 1664525 + 1013904223) % 4294967296
  return estado / 4294967296
}

let revisadas = 0

for (let intento = 0; intento < 400; intento++) {
  const cuantasPiezas = 1 + Math.floor(azar() * PIEZAS.length)
  const compases = 1 + Math.floor(azar() * 4)
  const rejilla = rejillaVacia(PIEZAS.slice(0, cuantasPiezas), compases)

  // Densidad variable: desde casi vacía hasta casi llena.
  const densidad = azar()
  for (const fila of rejilla.filas) {
    for (let i = 0; i < fila.casillas.length; i++) fila.casillas[i] = azar() < densidad
  }

  const hechos = rejillaACompases(rejilla)
  assert.equal(hechos.length, compases, 'salieron más o menos compases de los pedidos')

  hechos.forEach((compas, i) => {
    for (const voz of ['manos', 'pies']) {
      const suma = compas[voz].reduce((t, n) => t + ticksDeNota(n), 0)
      // Una voz vacía es legítima: nadie tocó esa pieza en ese compás.
      if (compas[voz].length === 0) continue
      assert.equal(
        suma,
        TICKS_COMPAS,
        `intento ${intento}, compás ${i + 1}, ${voz}: suma ${suma} en vez de ${TICKS_COMPAS}`,
      )
    }
  })

  // Y que pase el mismo validador que los ejercicios del catálogo.
  const problemas = revisarEjercicio({
    id: `rejilla-${intento}`,
    titulo: 'prueba',
    estilo: 'lectura',
    nivel: 1,
    compas: { pulsos: 4, figura: 4 },
    bpmSugerido: 80,
    descripcion: 'prueba',
    compases: hechos,
  })
  assert.equal(problemas.length, 0, `intento ${intento}: ${problemas.map((p) => p.mensaje).join(', ')}`)
  revisadas++
}

// Una rejilla vacía del todo son compases de silencio, no un error.
const vacia = rejillaACompases(rejillaVacia(['tarola'], 2))
assert.equal(vacia.length, 2)
assert.equal(vacia[0].manos.reduce((t, n) => t + ticksDeNota(n), 0), TICKS_COMPAS)

// Un golpe suelto en la última casilla del compás: el caso que más descuadra.
const ultima = rejillaVacia(['tarola'], 1)
ultima.filas[0].casillas[POR_COMPAS - 1] = true
const suelta = rejillaACompases(ultima)
assert.equal(suelta[0].manos.reduce((t, n) => t + ticksDeNota(n), 0), TICKS_COMPAS)

console.log(`${revisadas} rejillas al azar revisadas: todos los compases cuadran.`)
