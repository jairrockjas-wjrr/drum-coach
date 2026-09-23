// Manejo del AudioContext (el "motor" de sonido de la app).
//
// Reglas de iPhone/Safari que resuelve este módulo:
//  1. El audio solo puede arrancar dentro de un toque del usuario: creamos y
//     reanudamos el contexto en el primer tap.
//  2. El interruptor de silencio del iPhone puede silenciar Web Audio. Con
//     navigator.audioSession.type = 'playback' (Safari 16.4+) la app se declara
//     como reproductor y suena aunque el interruptor esté en silencio.
//     Si esa API no existe (iOS más viejo), no hay forma de evitarlo desde la web:
//     hay que subir el interruptor o conectar audífonos. Lo avisamos en pantalla.

let contexto: AudioContext | null = null
let salidaPrincipal: GainNode | null = null
// Dos buses separados para poder subir el click sin subir la batería y al revés.
let salidaClick: GainNode | null = null
let salidaBateria: GainNode | null = null

/** Indica si el navegador admite declarar la sesión de audio como 'playback'. */
export const admiteSesionDeAudio = (): boolean =>
  typeof navigator !== 'undefined' && 'audioSession' in navigator

/**
 * Crea (si hace falta) y reanuda el contexto de audio.
 * Debe llamarse DENTRO de un evento de toque/clic del usuario.
 */
export async function desbloquearAudio(): Promise<AudioContext> {
  if (!contexto) {
    const Constructor = window.AudioContext ?? window.webkitAudioContext
    if (!Constructor) throw new Error('Este navegador no admite Web Audio.')

    // latencyHint 'interactive': la menor latencia posible, clave para el metrónomo.
    contexto = new Constructor({ latencyHint: 'interactive' })

    salidaPrincipal = contexto.createGain()
    salidaPrincipal.gain.value = 1
    salidaPrincipal.connect(contexto.destination)

    salidaClick = contexto.createGain()
    salidaClick.gain.value = 1
    salidaClick.connect(salidaPrincipal)

    salidaBateria = contexto.createGain()
    // Un poco por debajo de 1 para que dos piezas juntas (bombo + crash) no saturen.
    salidaBateria.gain.value = 0.8
    salidaBateria.connect(salidaPrincipal)
  }

  // Declarar la sesión como reproducción (ignora el interruptor de silencio en iOS).
  const sesion = navigator.audioSession
  if (sesion) sesion.type = 'playback'

  if (contexto.state !== 'running') await contexto.resume()
  return contexto
}

/** Devuelve el contexto ya desbloqueado, o null si todavía no hubo un toque. */
export const obtenerContexto = (): AudioContext | null => contexto

/** Nodo al que se conecta todo lo que suena (volumen general). */
export function obtenerSalida(): GainNode {
  if (!salidaPrincipal) throw new Error('El audio aún no se ha desbloqueado.')
  return salidaPrincipal
}

/** Bus del metrónomo. */
export function obtenerSalidaClick(): GainNode {
  if (!salidaClick) throw new Error('El audio aún no se ha desbloqueado.')
  return salidaClick
}

/** Bus de la batería. */
export function obtenerSalidaBateria(): GainNode {
  if (!salidaBateria) throw new Error('El audio aún no se ha desbloqueado.')
  return salidaBateria
}

/** Estado actual, para mostrarlo en pantalla. */
export const estadoAudio = (): 'sin-iniciar' | AudioContextState =>
  contexto ? contexto.state : 'sin-iniciar'

// Al volver a la app desde otra pantalla, iOS suspende el audio: lo reanudamos.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && contexto?.state === 'suspended') {
      void contexto.resume()
    }
  })
}

/**
 * Cuánto tarda en oírse lo que se programa: el sonido sale del navegador y
 * todavía tiene que pasar por el sistema y el altavoz. Si no se tiene en
 * cuenta, la luz del cursor va por delante del golpe. Con auriculares
 * Bluetooth el retraso es mucho mayor y el navegador no siempre lo sabe, por
 * eso la app deja además un ajuste fino a mano.
 */
export function latenciaDeSalida(contexto: AudioContext): number {
  const propia = contexto.outputLatency
  if (typeof propia === 'number' && propia > 0) return propia
  return contexto.baseLatency ?? 0
}
