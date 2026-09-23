// Registro del service worker (lo que permite abrir la app sin internet).
// En desarrollo no se registra, para no servir archivos viejos mientras programamos.

export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    // Con la compilación en la dirección, el navegador ve un service worker
    // nuevo en cada publicación y renueva todo lo guardado.
    const ruta = `${import.meta.env.BASE_URL}sw.js?v=${__COMPILACION__}`
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
