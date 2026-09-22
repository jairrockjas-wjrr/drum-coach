// Tipos que todavía no están en las definiciones estándar de TypeScript.

// Safari/iOS 16.4+: permite declarar que la app reproduce audio, para que el
// interruptor de silencio del iPhone no la silencie. Aún no es estándar.
interface AudioSession {
  type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
}

interface Navigator {
  readonly audioSession?: AudioSession
}

interface Window {
  // Safari antiguo exponía el AudioContext con prefijo.
  webkitAudioContext?: typeof AudioContext
}
