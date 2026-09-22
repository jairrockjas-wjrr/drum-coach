// Registro del service worker (lo que permite abrir la app sin internet).
// En desarrollo no se registra, para no servir archivos viejos mientras programamos.

export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    const ruta = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(ruta, { scope: import.meta.env.BASE_URL }).catch((error) => {
      console.warn('No se pudo registrar el service worker:', error)
    })
  })
}

/** Detecta si la app está abierta desde la pantalla de inicio (instalada). */
export const estaInstalada = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Safari en iOS usa esta propiedad propia.
  (navigator as Navigator & { standalone?: boolean }).standalone === true
