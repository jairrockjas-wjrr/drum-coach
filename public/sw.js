// Service worker de Drum Coach.
// Objetivo: que la app abra sin internet una vez instalada en el iPhone.
//
// Estrategia:
//  - Navegación (abrir la app): primero la red, y si no hay internet, la copia guardada.
//    Así siempre ves la versión nueva al abrir con datos, pero funciona offline.
//    Se pide con cache:'reload' para saltarse el caché del navegador: GitHub Pages
//    manda el HTML con 10 minutos de vida y sin esto una versión recién publicada
//    tardaba en aparecer aunque recargaras.
//  - Resto de archivos del mismo origen (JS, CSS, íconos): primero la copia guardada
//    (son archivos con hash en el nombre, nunca cambian), y si no está, se descarga y guarda.

const VERSION = 'drum-coach-v2'
const BASE = new URL('./', self.registration.scope).pathname

// Lo mínimo para que la app arranque sin internet.
const ESENCIALES = [BASE, BASE + 'manifest.webmanifest', BASE + 'iconos/icono-192.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION)
      // Si algún archivo falla no queremos romper la instalación completa.
      await Promise.allSettled(ESENCIALES.map((ruta) => cache.add(ruta)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Borra versiones viejas del caché.
      const nombres = await caches.keys()
      await Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)
  if (url.origin !== self.location.origin) return

  // Abrir la app: red primero, caché de respaldo.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          let respuesta
          try {
            respuesta = await fetch(peticion.url, { cache: 'reload', credentials: 'same-origin' })
          } catch {
            // Safari viejo puede no admitir cache:'reload'; pedimos normal.
            respuesta = await fetch(peticion)
          }
          const cache = await caches.open(VERSION)
          cache.put(BASE, respuesta.clone())
          return respuesta
        } catch {
          const cache = await caches.open(VERSION)
          return (await cache.match(BASE)) ?? Response.error()
        }
      })(),
    )
    return
  }

  // Archivos: caché primero.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(VERSION)
      const guardado = await cache.match(peticion)
      if (guardado) return guardado
      const respuesta = await fetch(peticion)
      if (respuesta.ok && respuesta.type === 'basic') cache.put(peticion, respuesta.clone())
      return respuesta
    })(),
  )
})
