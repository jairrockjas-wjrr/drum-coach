// Navegación de la app: un enrutador mínimo basado en la dirección (#/loquesea).
// No usamos librería: son pocas pantallas y así la app carga más rápido.

import { montarPantallaInicio } from './pantalla-inicio'
import { montarMetronomo } from './pantalla-metronomo'

export function iniciarApp(raiz: HTMLElement): void {
  // Cada pantalla puede devolver una función para soltar lo que dejó abierto
  // (el metrónomo sonando, la pantalla encendida…).
  let limpiar: (() => void) | null = null

  function pintar(): void {
    limpiar?.()
    limpiar = null

    const ruta = location.hash.replace(/^#/, '')
    if (ruta === '/metronomo') {
      limpiar = montarMetronomo(raiz, () => {
        location.hash = ''
      })
    } else {
      montarPantallaInicio(raiz)
    }
    window.scrollTo(0, 0)
  }

  window.addEventListener('hashchange', pintar)
  pintar()
}
