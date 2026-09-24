// Navegación de la app: un enrutador mínimo basado en la dirección (#/loquesea).
// No usamos librería: son pocas pantallas y así la app carga más rápido.

import { montarPantallaInicio } from './pantalla-inicio'
import { montarMetronomo } from './pantalla-metronomo'
import { montarEjercicio } from './pantalla-ejercicio'
import { montarLectura } from './pantalla-lectura'
import { montarLeccion } from './pantalla-leccion'
import { montarFiguras } from './pantalla-figuras'
import { montarTaller, montarEditorTaller } from './pantalla-taller'

export function iniciarApp(raiz: HTMLElement): void {
  // Cada pantalla puede devolver una función para soltar lo que dejó abierto
  // (el metrónomo sonando, la pantalla encendida…).
  let limpiar: (() => void) | null = null

  function pintar(): void {
    limpiar?.()
    limpiar = null

    // La dirección puede traer de dónde vienes (#/ejercicio/x?desde=/leccion/y),
    // para que el botón de volver regrese al mismo módulo y no siempre a la
    // lista de ejercicios.
    const completa = location.hash.replace(/^#/, '')
    const corte = completa.indexOf('?')
    const ruta = corte === -1 ? completa : completa.slice(0, corte)
    const desde = corte === -1 ? '' : new URLSearchParams(completa.slice(corte)).get('desde') ?? ''
    if (ruta === '/metronomo') {
      limpiar = montarMetronomo(raiz, () => {
        location.hash = ''
      })
    } else if (ruta === '/figuras') {
      limpiar = montarFiguras(raiz)
    } else if (ruta === '/ejercicios') {
      // La lista suelta de ejercicios ya no existe: ahora cada uno vive dentro
      // de su lección. Se redirige para no dejar tirado un enlace guardado.
      location.replace('#/lectura')
      return
    } else if (ruta === '/taller') {
      limpiar = montarTaller(raiz)
    } else if (ruta.startsWith('/taller/')) {
      limpiar = montarEditorTaller(raiz, ruta.slice('/taller/'.length))
    } else if (ruta.startsWith('/ejercicio/')) {
      const id = ruta.slice('/ejercicio/'.length)
      if (id.startsWith('mio-')) {
        // Es una partitura tuya: hay que sacarla de la biblioteca del teléfono,
        // y eso es asíncrono. Si te vas antes de que llegue, no se monta nada.
        let vivo = true
        let interno: (() => void) | null = null
        limpiar = () => {
          vivo = false
          interno?.()
        }
        void (async () => {
          const [{ buscarPartitura }, { rejillaAEjercicio }] = await Promise.all([
            import('../taller/almacen'),
            import('../taller/rejilla'),
          ])
          const partitura = await buscarPartitura(id)
          if (!vivo) return
          if (!partitura) {
            raiz.innerHTML = `
              <header class="barra"><a class="barra__volver" href="#/taller">‹ Mis partituras</a></header>
              <p class="nota">Esa partitura ya no está guardada.</p>`
            return
          }
          interno = montarEjercicio(
            raiz,
            id,
            desde,
            rejillaAEjercicio(id, partitura.titulo, partitura.rejilla, partitura.bpm),
          )
        })()
      } else {
        limpiar = montarEjercicio(raiz, id, desde)
      }
    } else if (ruta === '/lectura') {
      montarLectura(raiz)
    } else if (ruta.startsWith('/leccion/')) {
      limpiar = montarLeccion(raiz, ruta.slice('/leccion/'.length))
    } else {
      montarPantallaInicio(raiz)
    }
    window.scrollTo(0, 0)
  }

  window.addEventListener('hashchange', pintar)
  pintar()
}
