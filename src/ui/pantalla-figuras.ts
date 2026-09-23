// Módulo "Representación de cada nota": la tabla de figuras y silencios.
//
// Cada símbolo se puede pulsar para oírlo: se toca un compás entero lleno de
// esa figura, con el click detrás, que es la forma de entender de verdad
// cuántas entran en un compás.

import { desbloquearAudio } from '../audio/contexto'
import { KIT_POR_DEFECTO, cargarBateria, haySonidosReales, type Kit } from '../audio/bateria'
import { FIGURAS, cuantasEntran } from '../notacion/figuras'
import { crearReproductor, type Reproductor } from '../ejercicios/reproductor'
import type { Ejercicio, Figura, Nota } from '../ejercicios/tipos'
import { leer } from '../datos/preferencias'

const BPM = 60

/** Cuadrado de parar, dibujado: con carácter (■) nunca queda centrado. */
const ICONO_PARAR = `
  <svg class="figura__parar" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
  </svg>`

/** Un compás lleno de esa figura, para oír cuántas entran. */
function compasLleno(figura: Figura): Nota[] {
  return Array.from({ length: cuantasEntran(figura) }, (_, i) => ({
    figura,
    piezas: ['tarola' as const],
    mano: i % 2 === 0 ? ('R' as const) : ('L' as const),
  }))
}

/** Un compás lleno de esa figura, para oír cuántas entran. */
function ejercicioDeFigura(figura: Figura): Ejercicio {
  return {
    id: `figura-${figura}`,
    titulo: figura,
    estilo: 'lectura',
    nivel: 1,
    compas: { pulsos: 4, figura: 4 },
    bpmSugerido: BPM,
    descripcion: figura,
    compases: [{ manos: compasLleno(figura), pies: [] }],
  }
}

export function montarFiguras(raiz: HTMLElement): () => void {
  const kit: Kit = leer<{ kit: Kit }>('reproductor', { kit: KIT_POR_DEFECTO }).kit
  let reproductor: Reproductor | null = null
  let contexto: AudioContext | null = null

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#">‹ Inicio</a>
    </header>

    <header class="encabezado">
      <h1>Representación de cada nota</h1>
      <p>Cuánto dura cada figura, su silencio, y cuántas entran en un compás de 4/4.</p>
    </header>

    <section class="tarjeta">
      <p class="nota">
        Pulsa una figura para escucharla: suena un compás entero de ella con el
        click detrás. Vuelve a pulsar para parar. Los silencios no suenan —
        eso es lo que son— y están ahí solo para que aprendas a reconocerlos.
      </p>
      <div class="figuras">
        ${FIGURAS.map((f, i) => {
          const entran = cuantasEntran(f.figura)
          return `
          <article class="figura">
            <div class="figura__cabecera">
              <h2>${f.nombre}</h2>
              <p>Dura ${f.dura} · ${entran === 1 ? 'entra 1' : `entran ${entran}`} en un compás de 4/4</p>
            </div>
            <div class="figura__dibujos">
              <button class="figura__caja" type="button" data-figura="${i}">
                <span class="figura__lienzo" id="lienzo-${i}"></span>
                <small>${f.nombre}</small>
                ${ICONO_PARAR}
              </button>
              <span class="figura__caja figura__caja--muda">
                <span class="figura__lienzo" id="silencio-${i}"></span>
                <small>${f.nombreSilencio}</small>
              </span>
            </div>
          </article>`
        }).join('')}
      </div>
    </section>

    <section class="tarjeta">
      <h2>Cuando van unidas</h2>
      <p class="nota">
        La barra que une dos notas no cambia su duración: solo las agrupa dentro
        del mismo tiempo para que el compás se lea de un vistazo.
      </p>
      <div class="figuras">
        <article class="figura">
          <div class="figura__cabecera">
            <h2>Esto también son corcheas</h2>
            <p>Dos corcheas unidas por una barra: un tiempo entre las dos.</p>
          </div>
          <div class="figura__dibujos">
            <button class="figura__caja" type="button" data-figura="3">
              <span class="figura__lienzo" id="unidas-corchea"></span>
              <small>Dos corcheas</small>
              ${ICONO_PARAR}
            </button>
          </div>
        </article>
        <article class="figura">
          <div class="figura__cabecera">
            <h2>Esto también son semicorcheas</h2>
            <p>Dos barras en vez de una: cuantas más barras, más corta la figura.</p>
          </div>
          <div class="figura__dibujos">
            <button class="figura__caja" type="button" data-figura="4">
              <span class="figura__lienzo" id="unidas-semicorchea"></span>
              <small>Dos semicorcheas</small>
              ${ICONO_PARAR}
            </button>
          </div>
        </article>
      </div>
    </section>
  `

  // --- Dibujo (VexFlow se descarga aparte) ---
  void (async () => {
    const { dibujarFigura } = await import('../notacion/partitura')
    FIGURAS.forEach((f, i) => {
      const nota = raiz.querySelector<HTMLDivElement>(`#lienzo-${i}`)
      const silencio = raiz.querySelector<HTMLDivElement>(`#silencio-${i}`)
      if (nota) dibujarFigura(nota, f.figura)
      if (silencio) dibujarFigura(silencio, f.figura, { silencio: true })
    })
    const dosCorcheas = raiz.querySelector<HTMLDivElement>('#unidas-corchea')
    const dosSemis = raiz.querySelector<HTMLDivElement>('#unidas-semicorchea')
    if (dosCorcheas) dibujarFigura(dosCorcheas, 'corchea', { unidas: 2 })
    if (dosSemis) dibujarFigura(dosSemis, 'semicorchea', { unidas: 2 })
  })()

  // --- Escuchar ---
  // Temporizador que apaga la luz del botón cuando acaba el compás. Se guarda
  // para poder cancelarlo si se para antes de tiempo.
  let apagado: number | undefined

  const detener = (): void => {
    reproductor?.detener()
    reproductor = null
    window.clearTimeout(apagado)
    apagado = undefined
    for (const caja of raiz.querySelectorAll('.figura__caja--sonando')) {
      caja.classList.remove('figura__caja--sonando')
    }
  }

  const escuchar = async (caja: HTMLButtonElement): Promise<void> => {
    const ficha = FIGURAS[Number(caja.dataset.figura)]
    if (!ficha) return

    detener()
    contexto = await desbloquearAudio()
    if (!haySonidosReales(kit)) await cargarBateria(contexto, kit)

    caja.classList.add('figura__caja--sonando')
    reproductor = crearReproductor(contexto, ejercicioDeFigura(ficha.figura), {
      bpm: BPM,
      loop: false,
      conClick: true,
      silenciarManos: false,
      silenciarPies: false,
      escucharYTocar: false,
      volumenBateria: 0.9,
      volumenClick: 0.5,
      cuentaEntrada: 0,
      entrenador: { activo: false, incremento: 0, cadaCompases: 0, bpmMeta: BPM },
    })
    reproductor.iniciar()

    // Se apaga solo al acabar el compás.
    apagado = window.setTimeout(detener, (4 * 60_000) / BPM + 200)
  }

  raiz.addEventListener('click', (evento) => {
    const caja = (evento.target as HTMLElement).closest<HTMLButtonElement>('button.figura__caja')
    if (!caja) return
    // Si ya está sonando ésa, el mismo botón la para.
    if (caja.classList.contains('figura__caja--sonando')) detener()
    else void escuchar(caja)
  })

  return detener
}
