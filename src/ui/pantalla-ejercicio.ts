// Pantalla de un ejercicio: partitura, batería y click, todo sincronizado.

import { desbloquearAudio } from '../audio/contexto'
import { EJERCICIOS } from '../ejercicios/catalogo'
import type { Pieza } from '../ejercicios/tipos'
import {
  crearReproductor,
  type EventoReproduccion,
  type OpcionesReproductor,
  type Reproductor,
} from '../ejercicios/reproductor'
import type { NotaDibujada } from '../notacion/partitura'
import { ORDEN_LEYENDA, SITIO } from '../notacion/piezas'
import { NOMBRE_PIEZA } from '../audio/bateria'
import { BPM_MAXIMO, BPM_MINIMO } from '../metronomo/tipos'
import { guardar, leer } from '../datos/preferencias'
import { mantenerPantallaEncendida, soltarPantalla } from '../sistema/wake-lock'

const CLAVE_GUARDADO = 'reproductor'

interface Preferencias {
  loop: boolean
  conClick: boolean
  silenciarManos: boolean
  silenciarPies: boolean
  escucharYTocar: boolean
  volumenBateria: number
  volumenClick: number
  cuentaEntrada: 0 | 1 | 2
  mostrarSticking: boolean
  mostrarConteo: boolean
}

const POR_DEFECTO: Preferencias = {
  loop: true,
  conClick: true,
  silenciarManos: false,
  silenciarPies: false,
  escucharYTocar: false,
  volumenBateria: 0.9,
  volumenClick: 0.5,
  cuentaEntrada: 1,
  mostrarSticking: true,
  mostrarConteo: true,
}

export function montarEjercicio(raiz: HTMLElement, id: string): () => void {
  const ejercicio = EJERCICIOS.find((e) => e.id === id)
  if (!ejercicio) {
    raiz.innerHTML = `
      <header class="barra">
        <a class="barra__volver" href="#/ejercicios">‹ Ejercicios</a>
      </header>
      <p class="nota">Ese ejercicio ya no existe.</p>`
    return () => {}
  }

  const prefs = leer<Preferencias>(CLAVE_GUARDADO, POR_DEFECTO)
  // El BPM se guarda por ejercicio: cada uno tiene su velocidad de trabajo.
  let bpm = leer<{ bpm: number }>(`bpm:${ejercicio.id}`, { bpm: ejercicio.bpmSugerido }).bpm

  let reproductor: Reproductor | null = null
  let contexto: AudioContext | null = null
  let animacion = 0
  let notas: NotaDibujada[] = []
  let porClave = new Map<string, SVGElement>()
  const cola: EventoReproduccion[] = []

  const piezasUsadas = new Set<Pieza>()
  for (const compas of ejercicio.compases) {
    for (const voz of ['manos', 'pies'] as const) {
      for (const nota of compas[voz]) for (const pieza of nota.piezas) piezasUsadas.add(pieza)
    }
  }

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#/ejercicios">‹ Ejercicios</a>
      <span class="barra__titulo">${ejercicio.titulo}</span>
    </header>

    <section class="tarjeta">
      <p class="nota" style="margin-top:0">${ejercicio.descripcion}</p>
      <div class="hoja" id="hoja"></div>
      <p class="estado-ejercicio" id="estado"></p>
    </section>

    <section class="tarjeta practica">
      <div class="bpm">
        <button class="bpm__paso" data-paso="-5">−5</button>
        <button class="bpm__paso" data-paso="-1">−1</button>
        <div class="bpm__valor">
          <strong id="bpm-numero">${bpm}</strong>
          <small>BPM · sugerido ${ejercicio.bpmSugerido}</small>
        </div>
        <button class="bpm__paso" data-paso="1">+1</button>
        <button class="bpm__paso" data-paso="5">+5</button>
      </div>
      <input class="rango" type="range" id="bpm-rango" min="${BPM_MINIMO}" max="${BPM_MAXIMO}"
             value="${bpm}" aria-label="Velocidad en BPM" />
      <div class="acciones">
        <button class="boton boton--principal" id="tocar">Reproducir</button>
        <button class="boton" id="loop" aria-pressed="${prefs.loop}">Loop</button>
      </div>
      ${ejercicio.consejo ? `<p class="nota">💡 ${ejercicio.consejo}</p>` : ''}
    </section>

    <details class="tarjeta detalle">
      <summary>Ajustes</summary>
      <div class="campos">
        <label class="campo campo--interruptor">
          <span>Click del metrónomo</span>
          <input type="checkbox" id="con-click" ${prefs.conClick ? 'checked' : ''} />
        </label>
        <label class="campo campo--interruptor">
          <span>Silenciar manos <small>para estudiar solo los pies</small></span>
          <input type="checkbox" id="sin-manos" ${prefs.silenciarManos ? 'checked' : ''} />
        </label>
        <label class="campo campo--interruptor">
          <span>Silenciar pies</span>
          <input type="checkbox" id="sin-pies" ${prefs.silenciarPies ? 'checked' : ''} />
        </label>
        <label class="campo campo--interruptor">
          <span>Escuchar y tocar <small>una vuelta con batería, la siguiente solo click</small></span>
          <input type="checkbox" id="escuchar" ${prefs.escucharYTocar ? 'checked' : ''} />
        </label>
        <label class="campo">
          <span>Cuenta de entrada</span>
          <select id="entrada">
            <option value="0" ${prefs.cuentaEntrada === 0 ? 'selected' : ''}>Sin cuenta</option>
            <option value="1" ${prefs.cuentaEntrada === 1 ? 'selected' : ''}>1 compás</option>
            <option value="2" ${prefs.cuentaEntrada === 2 ? 'selected' : ''}>2 compases</option>
          </select>
        </label>
        <label class="campo campo--interruptor">
          <span>Mostrar sticking (R/L)</span>
          <input type="checkbox" id="ver-sticking" ${prefs.mostrarSticking ? 'checked' : ''} />
        </label>
        <label class="campo campo--interruptor">
          <span>Mostrar el conteo</span>
          <input type="checkbox" id="ver-conteo" ${prefs.mostrarConteo ? 'checked' : ''} />
        </label>
        <label class="campo">
          <span>Volumen de la batería</span>
          <input type="range" class="rango" id="vol-bateria" min="0" max="100"
                 value="${Math.round(prefs.volumenBateria * 100)}" />
        </label>
        <label class="campo">
          <span>Volumen del click</span>
          <input type="range" class="rango" id="vol-click" min="0" max="100"
                 value="${Math.round(prefs.volumenClick * 100)}" />
        </label>
      </div>
    </details>

    <details class="tarjeta detalle">
      <summary>Qué es cada línea del pentagrama</summary>
      <ul class="estado">
        ${ORDEN_LEYENDA.filter((p) => piezasUsadas.has(p))
          .map(
            (pieza) => `
          <li><span class="punto punto--ok"></span>
            <span><strong>${NOMBRE_PIEZA[pieza]}:</strong> ${SITIO[pieza].donde}</span></li>`,
          )
          .join('')}
      </ul>
    </details>
  `

  const $ = <T extends HTMLElement>(id: string): T => raiz.querySelector<T>('#' + id)!
  const hoja = $<HTMLDivElement>('hoja')
  const botonTocar = $<HTMLButtonElement>('tocar')
  const botonLoop = $<HTMLButtonElement>('loop')
  const bpmNumero = $<HTMLElement>('bpm-numero')
  const bpmRango = $<HTMLInputElement>('bpm-rango')
  const estado = $<HTMLElement>('estado')

  // --- Partitura ---
  // El dibujo de partituras (VexFlow) se descarga aparte, solo al abrir un
  // ejercicio, para que la app arranque ligera.
  let dibujar: typeof import('../notacion/partitura').dibujarPartitura | null = null

  async function pintarPartitura(): Promise<void> {
    if (!dibujar) {
      hoja.innerHTML = '<p class="cargando">Preparando la partitura…</p>'
      dibujar = (await import('../notacion/partitura')).dibujarPartitura
    }
    const ancho = Math.max(280, hoja.clientWidth || raiz.clientWidth - 40)
    notas = dibujar(hoja, ejercicio!, {
      ancho,
      mostrarSticking: prefs.mostrarSticking,
      mostrarConteo: prefs.mostrarConteo,
    })
    porClave = new Map()
    for (const nota of notas) {
      if (nota.elemento) porClave.set(`${nota.compas}-${nota.voz}-${nota.indice}`, nota.elemento)
    }
  }

  function apagarCursor(): void {
    hoja.querySelectorAll('.sonando').forEach((el) => el.classList.remove('sonando'))
  }

  function pintarEvento(evento: EventoReproduccion): void {
    if (evento.enCuentaEntrada) {
      estado.textContent = `Cuenta de entrada… ${(evento.pulso ?? 0) + 1}`
      return
    }
    if (evento.tipo === 'click') {
      const partes = [`Compás ${evento.compas + 1}`]
      if (opcionesActuales().escucharYTocar) {
        partes.push(evento.soloClick ? 'tu turno: toca tú' : 'escucha')
      }
      estado.textContent = partes.join(' · ')
      return
    }

    const elemento = porClave.get(`${evento.compas}-${evento.voz}-${evento.indice}`)
    if (!elemento) return
    // Solo una nota encendida por voz, para que se vean las dos manos y pies.
    hoja
      .querySelectorAll(`.sonando[data-voz="${evento.voz}"]`)
      .forEach((el) => el.classList.remove('sonando'))
    elemento.setAttribute('data-voz', evento.voz ?? '')
    elemento.classList.add('sonando')
  }

  function bucleVisual(): void {
    if (!contexto || !reproductor?.estaSonando()) return
    const ahora = contexto.currentTime
    while (cola.length > 0 && cola[0].cuando <= ahora) pintarEvento(cola.shift()!)
    animacion = requestAnimationFrame(bucleVisual)
  }

  // --- Opciones ---
  const opcionesActuales = (): OpcionesReproductor => ({
    bpm,
    loop: prefs.loop,
    conClick: prefs.conClick,
    silenciarManos: prefs.silenciarManos,
    silenciarPies: prefs.silenciarPies,
    escucharYTocar: prefs.escucharYTocar,
    volumenBateria: prefs.volumenBateria,
    volumenClick: prefs.volumenClick,
    cuentaEntrada: prefs.cuentaEntrada,
  })

  function guardarPrefs(): void {
    guardar(CLAVE_GUARDADO, prefs)
    reproductor?.actualizar(opcionesActuales())
  }

  function detener(): void {
    reproductor?.detener()
    cancelAnimationFrame(animacion)
    cola.length = 0
    apagarCursor()
    botonTocar.textContent = 'Reproducir'
    botonTocar.classList.remove('boton--parar')
    estado.textContent = ''
    void soltarPantalla()
  }

  async function alternar(): Promise<void> {
    if (reproductor?.estaSonando()) {
      detener()
      return
    }
    contexto = await desbloquearAudio()
    reproductor = crearReproductor(contexto, ejercicio!, opcionesActuales())
    reproductor.alEvento((evento) => cola.push(evento))
    reproductor.iniciar()
    botonTocar.textContent = 'Detener'
    botonTocar.classList.add('boton--parar')
    animacion = requestAnimationFrame(bucleVisual)
    const ok = await mantenerPantallaEncendida()
    sessionStorage.setItem('drum-coach:pantalla-encendida', ok ? 'si' : 'no')
  }

  function cambiarBpm(nuevo: number): void {
    bpm = Math.min(BPM_MAXIMO, Math.max(BPM_MINIMO, Math.round(nuevo)))
    bpmNumero.textContent = String(bpm)
    bpmRango.value = String(bpm)
    cola.length = 0
    reproductor?.cambiarBpm(bpm)
    guardar(`bpm:${ejercicio!.id}`, { bpm })
  }

  // --- Conexiones ---
  botonTocar.addEventListener('click', () => void alternar())
  botonLoop.addEventListener('click', () => {
    prefs.loop = !prefs.loop
    botonLoop.setAttribute('aria-pressed', String(prefs.loop))
    botonLoop.classList.toggle('boton--activo', prefs.loop)
    guardarPrefs()
  })
  botonLoop.classList.toggle('boton--activo', prefs.loop)

  raiz.querySelectorAll<HTMLButtonElement>('.bpm__paso').forEach((boton) => {
    boton.addEventListener('click', () => cambiarBpm(bpm + Number(boton.dataset.paso)))
  })
  bpmRango.addEventListener('input', () => cambiarBpm(Number(bpmRango.value)))

  const casilla = (id: string, asignar: (valor: boolean) => void, redibujar = false): void => {
    $<HTMLInputElement>(id).addEventListener('change', (e) => {
      asignar((e.target as HTMLInputElement).checked)
      guardarPrefs()
      if (redibujar) void pintarPartitura()
    })
  }
  casilla('con-click', (v) => (prefs.conClick = v))
  casilla('sin-manos', (v) => (prefs.silenciarManos = v))
  casilla('sin-pies', (v) => (prefs.silenciarPies = v))
  casilla('escuchar', (v) => (prefs.escucharYTocar = v))
  casilla('ver-sticking', (v) => (prefs.mostrarSticking = v), true)
  casilla('ver-conteo', (v) => (prefs.mostrarConteo = v), true)

  $<HTMLSelectElement>('entrada').addEventListener('change', (e) => {
    prefs.cuentaEntrada = Number((e.target as HTMLSelectElement).value) as 0 | 1 | 2
    guardarPrefs()
  })
  $<HTMLInputElement>('vol-bateria').addEventListener('input', (e) => {
    prefs.volumenBateria = Number((e.target as HTMLInputElement).value) / 100
    guardarPrefs()
  })
  $<HTMLInputElement>('vol-click').addEventListener('input', (e) => {
    prefs.volumenClick = Number((e.target as HTMLInputElement).value) / 100
    guardarPrefs()
  })

  // Redibujar al girar el teléfono.
  let temporizadorAncho = 0
  const alCambiarTamano = (): void => {
    clearTimeout(temporizadorAncho)
    temporizadorAncho = window.setTimeout(() => void pintarPartitura(), 150)
  }
  window.addEventListener('resize', alCambiarTamano)

  void pintarPartitura()

  return () => {
    detener()
    window.removeEventListener('resize', alCambiarTamano)
    clearTimeout(temporizadorAncho)
  }
}
