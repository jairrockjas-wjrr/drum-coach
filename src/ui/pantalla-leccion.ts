// Una lección de lectura: la explicación, los ejemplos que se pueden oír y
// los ejercicios donde practicarla.

import { desbloquearAudio } from '../audio/contexto'
import {
  NOMBRE_PIEZA,
  cargarBateria,
  haySonidosReales,
  programarPieza,
  KIT_POR_DEFECTO,
  type Kit,
} from '../audio/bateria'
import { ORDEN_LEYENDA } from '../notacion/piezas'
import type { Pieza } from '../ejercicios/tipos'
import { EJERCICIOS } from '../ejercicios/catalogo'
import type { Ejercicio } from '../ejercicios/tipos'
import { crearReproductor, type Reproductor } from '../ejercicios/reproductor'
import { LECCIONES } from '../lecciones/catalogo'
import type { Ejemplo } from '../lecciones/tipos'
import { guardar, leer } from '../datos/preferencias'
import { CLAVE_HECHAS, type Hechas } from './pantalla-lectura'

/** Un ejemplo de la lección, visto como ejercicio para poder dibujarlo y oírlo. */
function comoEjercicio(leccion: string, ejemplo: Ejemplo, i: number): Ejercicio {
  return {
    id: `${leccion}-ejemplo-${i}`,
    titulo: ejemplo.titulo,
    estilo: 'lectura',
    nivel: 1,
    compas: ejemplo.compas,
    bpmSugerido: ejemplo.bpm,
    descripcion: ejemplo.pie ?? ejemplo.titulo,
    compases: ejemplo.compases,
  }
}

export function montarLeccion(raiz: HTMLElement, id: string): () => void {
  const leccion = LECCIONES.find((l) => l.id === id)
  if (!leccion) {
    raiz.innerHTML = `
      <header class="barra"><a class="barra__volver" href="#/lectura">‹ Lectura</a></header>
      <p class="nota">Esa lección ya no existe.</p>`
    return () => {}
  }

  const hechas = leer<Hechas>(CLAVE_HECHAS, {})
  const kit: Kit = leer<{ kit: Kit }>('reproductor', { kit: KIT_POR_DEFECTO }).kit

  let reproductor: Reproductor | null = null
  let contexto: AudioContext | null = null
  let sonando: number | null = null

  // Para llevar de la mano: al acabar, el enlace a la lección siguiente.
  const posicion = LECCIONES.findIndex((l) => l.id === leccion.id)
  const siguiente = LECCIONES[posicion + 1]

  const practicables = leccion.practica
    .map((idEjercicio) => EJERCICIOS.find((e) => e.id === idEjercicio))
    .filter((e): e is Ejercicio => Boolean(e))

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#/lectura">‹ Lectura</a>
    </header>

    <h1 class="leccion__titulo">${leccion.titulo}</h1>

    <section class="tarjeta leccion__texto">
      ${leccion.texto.map((parrafo) => `<p>${parrafo}</p>`).join('')}
    </section>

    ${
      leccion.leyenda
        ? `<section class="tarjeta">
             <h2>Cada pieza en su sitio</h2>
             <p class="nota" style="margin-top:0">Pulsa cada una para escucharla.</p>
             <div class="leyenda" id="leyenda"></div>
           </section>`
        : ''
    }

    ${leccion.ejemplos
      .map(
        (ejemplo, i) => `
      <section class="tarjeta">
        <h2>${ejemplo.titulo}</h2>
        <div class="hoja" id="hoja-${i}"></div>
        ${ejemplo.pie ? `<p class="nota">${ejemplo.pie}</p>` : ''}
        <button class="boton" data-ejemplo="${i}">Escuchar</button>
      </section>`,
      )
      .join('')}

    ${
      practicables.length > 0
        ? `<section class="tarjeta">
             <h2>Ahora practícalo</h2>
             <div class="modulos">
               ${practicables
                 .map(
                   (ejercicio) => `
                 <a class="boton modulo modulo--listo" href="#/ejercicio/${ejercicio.id}?desde=/leccion/${leccion.id}">
                   <span>${ejercicio.titulo}</span>
                   <small>${ejercicio.descripcion}</small>
                 </a>`,
                 )
                 .join('')}
             </div>
           </section>`
        : ''
    }

    <button class="boton ${hechas[leccion.id] ? 'boton--activo' : ''}" id="hecha">
      ${hechas[leccion.id] ? '✓ Lección hecha' : 'Marcar como hecha'}
    </button>

    ${
      siguiente
        ? `<a class="boton modulo modulo--listo" href="#/leccion/${siguiente.id}">
             <span>Siguiente: ${siguiente.titulo}</span>
             <small>${siguiente.resumen}</small>
           </a>`
        : `<a class="boton modulo modulo--listo" href="#/lectura">
             <span>Has llegado al final</span>
             <small>Vuelve a la ruta para repasar lo que quieras</small>
           </a>`
    }
  `

  /** Hace sonar una pieza suelta, para oírla desde la leyenda. */
  const sonarPieza = async (pieza: Pieza): Promise<void> => {
    contexto = await desbloquearAudio()
    if (!haySonidosReales(kit)) await cargarBateria(contexto, kit)
    programarPieza(contexto, pieza, { cuando: contexto.currentTime + 0.02, volumen: 0.9 })
  }

  // --- Dibujo de los ejemplos (VexFlow se descarga aparte) ---
  const pintar = async (): Promise<void> => {
    const { dibujarPartitura, dibujarLeyenda } = await import('../notacion/partitura')

    const leyenda = raiz.querySelector<HTMLDivElement>('#leyenda')
    if (leyenda) {
      dibujarLeyenda(leyenda, ORDEN_LEYENDA, NOMBRE_PIEZA, (pieza) => void sonarPieza(pieza))
    }

    leccion.ejemplos.forEach((ejemplo, i) => {
      const hoja = raiz.querySelector<HTMLDivElement>(`#hoja-${i}`)
      if (!hoja) return
      dibujarPartitura(hoja, comoEjercicio(leccion.id, ejemplo, i), {
        ancho: Math.max(280, hoja.clientWidth),
      })
    })
  }
  void pintar()

  // --- Escuchar un ejemplo ---
  const detener = (): void => {
    reproductor?.detener()
    reproductor = null
    if (sonando !== null) {
      const boton = raiz.querySelector<HTMLButtonElement>(`[data-ejemplo="${sonando}"]`)
      if (boton) boton.textContent = 'Escuchar'
      sonando = null
    }
  }

  const escuchar = async (i: number): Promise<void> => {
    const eraEste = sonando === i
    detener()
    if (eraEste) return

    const boton = raiz.querySelector<HTMLButtonElement>(`[data-ejemplo="${i}"]`)!
    contexto = await desbloquearAudio()
    if (!haySonidosReales(kit)) {
      boton.textContent = 'Cargando…'
      await cargarBateria(contexto, kit)
    }

    const ejemplo = leccion.ejemplos[i]
    reproductor = crearReproductor(contexto, comoEjercicio(leccion.id, ejemplo, i), {
      bpm: ejemplo.bpm,
      loop: false,
      conClick: true,
      silenciarManos: false,
      silenciarPies: false,
      escucharYTocar: false,
      volumenBateria: 0.9,
      volumenClick: 0.5,
      cuentaEntrada: 1,
      entrenador: { activo: false, incremento: 5, cadaCompases: 4, bpmMeta: 120 },
    })
    reproductor.iniciar()
    sonando = i
    boton.textContent = 'Detener'

    // Al acabar (no hay bucle), el botón vuelve solo a su sitio.
    const vigilar = window.setInterval(() => {
      if (reproductor?.estaSonando()) return
      clearInterval(vigilar)
      if (sonando === i) detener()
    }, 200)
  }

  raiz.querySelectorAll<HTMLButtonElement>('[data-ejemplo]').forEach((boton) => {
    boton.addEventListener('click', () => void escuchar(Number(boton.dataset.ejemplo)))
  })

  // --- Marcar la lección como hecha ---
  const botonHecha = raiz.querySelector<HTMLButtonElement>('#hecha')!
  botonHecha.addEventListener('click', () => {
    hechas[leccion.id] = !hechas[leccion.id]
    guardar(CLAVE_HECHAS, hechas)
    botonHecha.textContent = hechas[leccion.id] ? '✓ Lección hecha' : 'Marcar como hecha'
    botonHecha.classList.toggle('boton--activo', hechas[leccion.id])
  })

  return detener
}
