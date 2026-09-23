// Navegación de la app: un enrutador mínimo basado en la dirección (#/loquesea).
// No usamos librería: son pocas pantallas y así la app carga más rápido.

import { montarPantallaInicio } from './pantalla-inicio'
import { montarMetronomo } from './pantalla-metronomo'
import { montarListaEjercicios } from './pantalla-ejercicios'
import { montarEjercicio } from './pantalla-ejercicio'
import { montarLectura } from './pantalla-lectura'
import { montarLeccion } from './pantalla-leccion'
import { montarFiguras } from './pantalla-figuras'

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
      montarListaEjercicios(raiz)
    } else if (ruta.startsWith('/ejercicio/')) {
      limpiar = montarEjercicio(raiz, ruta.slice('/ejercicio/'.length), desde)
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
