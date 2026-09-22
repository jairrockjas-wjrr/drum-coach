// Pantalla de inicio de la Fase 1.
// Sirve para dos cosas: comprobar que el audio funciona en el iPhone y
// mostrar el estado del sistema (sonido, pantalla encendida, instalación).

import { desbloquearAudio, admiteSesionDeAudio, estadoAudio } from '../audio/contexto'
import { sonarPrueba } from '../audio/click'
import {
  admiteWakeLock,
  mantenerPantallaEncendida,
  soltarPantalla,
  pantallaBloqueada,
} from '../sistema/wake-lock'
import { estaInstalada } from '../sistema/pwa'

type Nivel = 'ok' | 'aviso' | 'error' | 'neutro'

interface Linea {
  nivel: Nivel
  titulo: string
  detalle: string
}

// Módulos que llegan en las siguientes fases (se muestran apagados).
const PROXIMOS = [
  ['Metrónomo', 'Fase 2 · tap tempo, swing, 2 y 4, entrenador de velocidad'],
  ['Ejercicios con partitura', 'Fase 3 · se ven y se escuchan'],
  ['Lectura desde cero', 'Fase 4 · del pentagrama a los tresillos'],
  ['Jazz', 'Fase 5 · ride, comping e independencia'],
  ['Doble pedal', 'Fase 6 · velocidad y resistencia'],
  ['Generador de remates', 'Fase 7 · fills nuevos cada vez'],
]

export function montarPantallaInicio(raiz: HTMLElement): void {
  raiz.innerHTML = `
    <header class="encabezado">
      <h1>Drum Coach</h1>
      <p>Tu sala de ensayo de bolsillo.</p>
    </header>

    <section class="tarjeta">
      <h2>Prueba de sonido</h2>
      <button class="boton boton--principal" id="probar-audio">
        Tocar para activar el sonido
      </button>
      <ul class="estado" id="estado" style="margin-top:16px"></ul>
    </section>

    <section class="tarjeta">
      <h2>Próximos módulos</h2>
      <div class="modulos">
        ${PROXIMOS.map(
          ([nombre, nota]) => `
          <button class="boton modulo" disabled>
            <span>${nombre}</span>
            <small>${nota}</small>
          </button>`,
        ).join('')}
      </div>
    </section>

    <p class="pie">Versión 0.1 · Fase 1: base, PWA y publicación</p>
  `

  const boton = raiz.querySelector<HTMLButtonElement>('#probar-audio')!
  const lista = raiz.querySelector<HTMLUListElement>('#estado')!

  // --- Estado en pantalla ---
  function pintarEstado(): void {
    const audio = estadoAudio()
    const lineas: Linea[] = [
      {
        nivel: audio === 'running' ? 'ok' : 'neutro',
        titulo: 'Sonido',
        detalle:
          audio === 'running'
            ? 'activo y listo'
            : 'toca el botón de arriba (iOS solo permite audio tras un toque)',
      },
      {
        nivel: admiteSesionDeAudio() ? 'ok' : 'aviso',
        titulo: 'Interruptor de silencio',
        detalle: admiteSesionDeAudio()
          ? 'la app suena aunque el iPhone esté en silencio'
          : 'tu iOS no admite esta función: sube el interruptor lateral o usa audífonos',
      },
      {
        nivel: admiteWakeLock() ? (pantallaBloqueada() ? 'ok' : 'neutro') : 'aviso',
        titulo: 'Pantalla encendida',
        detalle: !admiteWakeLock()
          ? 'no disponible en este navegador: sube el bloqueo automático en Ajustes'
          : pantallaBloqueada()
            ? 'la pantalla no se apagará mientras practicas'
            : 'se activará al empezar a practicar',
      },
      {
        nivel: estaInstalada() ? 'ok' : 'neutro',
        titulo: 'Instalación',
        detalle: estaInstalada()
          ? 'abierta desde la pantalla de inicio'
          : 'en Safari: Compartir → Agregar a inicio',
      },
    ]

    lista.innerHTML = lineas
      .map(
        (l) => `
        <li>
          <span class="punto ${l.nivel === 'neutro' ? '' : `punto--${l.nivel}`}"></span>
          <span><strong>${l.titulo}:</strong> ${l.detalle}</span>
        </li>`,
      )
      .join('')
  }

  // --- Toque del usuario: desbloquea el audio y suena la prueba ---
  boton.addEventListener('click', async () => {
    boton.disabled = true
    try {
      const contexto = await desbloquearAudio()
      sonarPrueba(contexto)
      boton.textContent = 'Volver a probar (4 clicks a 100 BPM)'

      // Aprovechamos el mismo gesto para pedir la pantalla encendida.
      if (!pantallaBloqueada()) {
        const ok = await mantenerPantallaEncendida()
        sessionStorage.setItem('drum-coach:pantalla-encendida', ok ? 'si' : 'no')
      }
    } catch (error) {
      boton.textContent = 'No se pudo iniciar el audio'
      console.error(error)
    } finally {
      boton.disabled = false
      pintarEstado()
    }
  })

  // Si la app se oculta un buen rato, soltamos la pantalla para no gastar batería.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void soltarPantalla()
    pintarEstado()
  })

  pintarEstado()
}
