// Reglas musicales del metrónomo, sin nada de audio ni de pantalla.
// Al estar aisladas se pueden probar solas: ver pruebas/logica.mjs.

import type { ConfigMetronomo, Subdivision, TipoClick } from './tipos'

/**
 * Posición de cada nota dentro del pulso, como fracción de 0 a 1.
 * Con corcheas y swing, la segunda corchea se corre hacia adelante:
 * 50 % = recto, 67 % ≈ tresillo de jazz.
 */
export function fraccionesDelPulso(subdivision: Subdivision, swing: number): number[] {
  if (subdivision === 2 && swing !== 50) return [0, Math.min(0.9, Math.max(0.1, swing / 100))]
  return Array.from({ length: subdivision }, (_, i) => i / subdivision)
}

/** Decide qué click corresponde a una posición, o null si ahí no suena nada. */
export function tipoDeClick(
  config: ConfigMetronomo,
  pulso: number,
  subdivision: number,
  enCuentaEntrada: boolean,
): TipoClick | null {
  // En la cuenta de entrada solo marcamos los pulsos, sin adornos.
  if (enCuentaEntrada) {
    if (subdivision > 0) return null
    return pulso === 0 ? 'acento' : 'pulso'
  }

  // Modo jazz: solo los tiempos 2 y 4, sin subdivisiones.
  if (config.soloDosYCuatro) {
    if (subdivision > 0) return null
    return pulso === 1 || pulso === 3 ? 'pulso' : null
  }

  if (subdivision > 0) return 'subdivision'
  if (pulso === 0 && config.acentoEnUno) return 'acento'

  // Compases compuestos (6/8, 12/8): acento medio al inicio de cada grupo de tres.
  const esCompuesto = config.compas.figura === 8 && config.compas.pulsos % 3 === 0
  if (esCompuesto && config.compas.pulsos > 3 && pulso % 3 === 0) return 'medio'

  return 'pulso'
}
