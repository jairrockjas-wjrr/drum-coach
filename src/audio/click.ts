// Click del metrónomo, sintetizado con Web Audio.
//
// IMPORTANTE: el click nunca se dispara con setTimeout/setInterval.
// Se programa para un instante exacto del reloj de audio (audioContext.currentTime),
// que es el único reloj preciso del navegador. En la Fase 2 el metrónomo usará
// esta misma función con un scheduler de lookahead.

import { obtenerSalida } from './contexto'

export interface OpcionesClick {
  /** Instante del reloj de audio en el que debe sonar. */
  cuando: number
  /** true = acento (el "1" del compás): más agudo y un poco más fuerte. */
  acento?: boolean
  /** Volumen 0–1. */
  volumen?: number
}

/** Programa un click para que suene en el instante indicado. */
export function programarClick(
  contexto: AudioContext,
  { cuando, acento = false, volumen = 0.9 }: OpcionesClick,
): void {
  const frecuencia = acento ? 1600 : 1000
  const duracion = 0.035

  const oscilador = contexto.createOscillator()
  oscilador.type = 'square'
  oscilador.frequency.setValueAtTime(frecuencia, cuando)

  // Envolvente muy corta: ataque instantáneo y caída rápida, para un click seco.
  const envolvente = contexto.createGain()
  const pico = volumen * (acento ? 1 : 0.75)
  envolvente.gain.setValueAtTime(0.0001, cuando)
  envolvente.gain.exponentialRampToValueAtTime(pico, cuando + 0.001)
  envolvente.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion)

  oscilador.connect(envolvente)
  envolvente.connect(obtenerSalida())

  oscilador.start(cuando)
  oscilador.stop(cuando + duracion + 0.01)
  // Liberamos los nodos cuando terminan para no acumular memoria.
  oscilador.onended = () => {
    oscilador.disconnect()
    envolvente.disconnect()
  }
}

/**
 * Prueba de sonido: cuatro clicks (acento en el 1) a 100 BPM.
 * Sirve para confirmar en el iPhone que el audio funciona y a qué volumen.
 */
export function sonarPrueba(contexto: AudioContext): void {
  const inicio = contexto.currentTime + 0.1 // pequeño margen para programar sin cortes
  const pulso = 60 / 100
  for (let i = 0; i < 4; i++) {
    programarClick(contexto, { cuando: inicio + i * pulso, acento: i === 0 })
  }
}
