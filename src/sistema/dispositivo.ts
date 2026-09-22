// Detección del dispositivo, solo para mostrar mensajes de ayuda correctos.
// Nunca se usa para decidir funciones: eso se hace preguntando por cada API.

/** true si la app corre en iPhone o iPad. */
export const esIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS se hace pasar por Mac; se delata por el soporte táctil.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
