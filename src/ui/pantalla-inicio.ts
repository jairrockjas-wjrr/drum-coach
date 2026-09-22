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
import { esIOS } from '../sistema/dispositivo'

type Nivel = 'ok' | 'aviso' | 'error' | 'neutro'

interface Linea {
  nivel: Nivel
  titulo: string
  detalle: string
}

// Módulos de la app. Los que todavía no existen se muestran apagados.
interface Modulo {
  nombre: string
  nota: string
  /** Dirección interna; si falta, el módulo aún no está hecho. */
  ruta?: string
}

const MODULOS: Modulo[] = [
  {
    nombre: 'Metrónomo',
    nota: 'tap tempo, swing, 2 y 4, entrenador de velocidad',
    ruta: '#/metronomo',
  },
  { nombre: 'Ejercicios con partitura', nota: 'Fase 3 · se ven y se escuchan' },
  { nombre: 'Lectura desde cero', nota: 'Fase 4 · del pentagrama a los tresillos' },
  { nombre: 'Jazz', nota: 'Fase 5 · ride, comping e independencia' },
  { nombre: 'Doble pedal', nota: 'Fase 6 · velocidad y resistencia' },
  { nombre: 'Generador de remates', nota: 'Fase 7 · fills nuevos cada vez' },
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
      <p class="nota">
        Listo: la app se usa aquí mismo, en el navegador. Instalarla en la pantalla
        de inicio es opcional y solo sirve para abrirla más rápido y sin internet.
      </p>
      <details class="detalle">
        <summary>Ver estado del sistema</summary>
        <ul class="estado" id="estado"></ul>
      </details>
    </section>

    <section class="tarjeta">
      <h2>Módulos</h2>
      <p class="nota">Los apagados todavía no están hechos: llegan en las siguientes fases.</p>
      <div class="modulos">
        ${MODULOS.map((m) =>
          m.ruta
            ? `<a class="boton modulo modulo--listo" href="${m.ruta}">
                 <span>${m.nombre}</span>
                 <small>${m.nota}</small>
               </a>`
            : `<button class="boton modulo" disabled>
                 <span>${m.nombre}</span>
                 <small>${m.nota}</small>
               </button>`,
        ).join('')}
      </div>
    </section>

    <p class="pie">Versión 0.2 · Fase 2: metrónomo</p>
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
        // Este punto solo importa en iPhone; en la computadora no hay interruptor.
        nivel: !esIOS() ? 'neutro' : admiteSesionDeAudio() ? 'ok' : 'aviso',
        titulo: 'Interruptor de silencio',
        detalle: !esIOS()
          ? 'solo aplica en el iPhone; aquí manda el volumen del sistema'
          : admiteSesionDeAudio()
            ? 'la app suena aunque el iPhone esté en silencio'
            : 'tu iOS no admite esta función: sube el interruptor lateral o usa audífonos',
      },
      {
        nivel: admiteWakeLock() ? (pantallaBloqueada() ? 'ok' : 'neutro') : 'aviso',
        titulo: 'Pantalla encendida',
        detalle: !admiteWakeLock()
          ? 'no disponible en este navegador: sube el tiempo de bloqueo automático'
          : pantallaBloqueada()
            ? 'la pantalla no se apagará mientras practicas'
            : 'se activará al empezar a practicar',
      },
      {
        nivel: estaInstalada() ? 'ok' : 'neutro',
        titulo: 'Instalación (opcional)',
        detalle: estaInstalada()
          ? 'abierta desde la pantalla de inicio'
          : esIOS()
            ? 'en Safari: Compartir → Agregar a inicio'
            : 'estás en el navegador; para instalarla, abre esta página en el iPhone',
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
