// Click del metrónomo, sintetizado con Web Audio.
//
// IMPORTANTE: el click nunca se dispara con setTimeout/setInterval.
// Se programa para un instante exacto del reloj de audio (audioContext.currentTime),
// que es el único reloj preciso del navegador. El motor del metrónomo
// (src/metronomo/motor.ts) usa esta función con un scheduler de lookahead.

import { obtenerSalida } from './contexto'
import type { TipoClick } from '../metronomo/tipos'

/** Sonido de cada tipo de click: agudo y fuerte el acento, suave la subdivisión. */
const SONIDOS: Record<TipoClick, { frecuencia: number; ganancia: number; duracion: number }> = {
  acento: { frecuencia: 1600, ganancia: 1, duracion: 0.035 },
  medio: { frecuencia: 1250, ganancia: 0.72, duracion: 0.032 },
  pulso: { frecuencia: 1000, ganancia: 0.62, duracion: 0.03 },
  subdivision: { frecuencia: 760, ganancia: 0.26, duracion: 0.022 },
}

export interface OpcionesClick {
  /** Instante del reloj de audio en el que debe sonar. */
  cuando: number
  tipo?: TipoClick
  /** Volumen general, 0–1. */
  volumen?: number
}

/**
 * Programa un click para que suene en el instante indicado.
 * Devuelve el oscilador para poder cancelarlo si el tempo cambia antes de que suene.
 */
export function programarClick(
  contexto: AudioContext,
  { cuando, tipo = 'pulso', volumen = 0.9 }: OpcionesClick,
): OscillatorNode {
  const sonido = SONIDOS[tipo]

  const oscilador = contexto.createOscillator()
  oscilador.type = 'square'
  oscilador.frequency.setValueAtTime(sonido.frecuencia, cuando)

  // Envolvente muy corta: ataque instantáneo y caída rápida, para un click seco.
  const envolvente = contexto.createGain()
  const pico = Math.max(0.0002, sonido.ganancia * volumen)
  envolvente.gain.setValueAtTime(0.0001, cuando)
  envolvente.gain.exponentialRampToValueAtTime(pico, cuando + 0.001)
  envolvente.gain.exponentialRampToValueAtTime(0.0001, cuando + sonido.duracion)

  oscilador.connect(envolvente)
  envolvente.connect(obtenerSalida())

  oscilador.start(cuando)
  oscilador.stop(cuando + sonido.duracion + 0.01)
  // Liberamos los nodos cuando terminan para no acumular memoria.
  oscilador.onended = () => {
    oscilador.disconnect()
    envolvente.disconnect()
  }

  return oscilador
}

/**
 * Prueba de sonido: cuatro clicks (acento en el 1) a 100 BPM.
 * Sirve para confirmar en el iPhone que el audio funciona y a qué volumen.
 */
export function sonarPrueba(contexto: AudioContext): void {
  const inicio = contexto.currentTime + 0.1 // pequeño margen para programar sin cortes
  const pulso = 60 / 100
  for (let i = 0; i < 4; i++) {
    programarClick(contexto, { cuando: inicio + i * pulso, tipo: i === 0 ? 'acento' : 'pulso' })
  }
}
