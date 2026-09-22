// Mantiene la pantalla encendida mientras practicas (Screen Wake Lock API).
// Safari de iPhone lo admite desde iOS 16.4. Si no está disponible, la app
// sigue funcionando: solo hay que subir el tiempo de bloqueo en Ajustes.

let bloqueo: WakeLockSentinel | null = null

export const admiteWakeLock = (): boolean =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** Pide mantener la pantalla encendida. Devuelve true si lo consiguió. */
export async function mantenerPantallaEncendida(): Promise<boolean> {
  if (!admiteWakeLock()) return false
  try {
    bloqueo = await navigator.wakeLock.request('screen')
    bloqueo.addEventListener('release', () => {
      bloqueo = null
    })
    return true
  } catch {
    // iOS lo rechaza si la batería está muy baja o la pestaña no está visible.
    return false
  }
}

/** Deja que la pantalla se apague normalmente. */
export async function soltarPantalla(): Promise<void> {
  await bloqueo?.release()
  bloqueo = null
}

export const pantallaBloqueada = (): boolean => bloqueo !== null

// iOS suelta el bloqueo al salir de la app: lo volvemos a pedir al regresar.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && bloqueo === null) {
      // Solo se re-pide si el usuario ya lo había activado antes.
      if (sessionStorage.getItem('drum-coach:pantalla-encendida') === 'si') {
        void mantenerPantallaEncendida()
      }
    }
  })
}
