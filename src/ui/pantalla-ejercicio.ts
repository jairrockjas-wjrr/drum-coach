// Pantalla de un ejercicio, pensada para el atril:
// la partitura ocupa toda la pantalla, el metrónomo va arriba en una barra
// compacta, y el resto de opciones se abren con el botón ⋯.

import { desbloquearAudio, latenciaDeSalida } from '../audio/contexto'
import { EJERCICIOS } from '../ejercicios/catalogo'
import { ticksPorCompas, type Pieza } from '../ejercicios/tipos'
import {
  crearReproductor,
  type EventoReproduccion,
  type OpcionesReproductor,
  type Reproductor,
} from '../ejercicios/reproductor'
import type { NotaDibujada } from '../notacion/partitura'
import { ORDEN_LEYENDA } from '../notacion/piezas'
import {
  KITS,
  KIT_POR_DEFECTO,
  NOMBRE_PIEZA,
  cargarBateria,
  haySonidosReales,
  programarPieza,
  type Kit,
} from '../audio/bateria'
import { BPM_MAXIMO, BPM_MINIMO } from '../metronomo/tipos'
import { guardar, leer } from '../datos/preferencias'
import { mantenerPantallaEncendida, soltarPantalla } from '../sistema/wake-lock'

const CLAVE_GUARDADO = 'reproductor'

/** Iconos dibujados. Con caracteres (▶, ⟳, ✕) nunca quedan centrados. */
const ICONOS = {
  volver: '<path d="M14.5 5 8 12l6.5 7"/>',
  tocar: '<path d="M8.5 5.5 18 12l-9.5 6.5z" fill="currentColor" stroke="none"/>',
  pausa:
    '<rect x="8" y="6.5" width="3" height="11" rx="1" fill="currentColor" stroke="none"/><rect x="13" y="6.5" width="3" height="11" rx="1" fill="currentColor" stroke="none"/>',
  parar: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none"/>',
  bucle: '<path d="M5 10a6 6 0 0 1 10-4.5"/><path d="M19 14a6 6 0 0 1-10 4.5"/><path d="M15 2.5v3.5h-3.5"/><path d="M9 21.5V18h3.5"/>',
  ajustes: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  cerrar: '<path d="M6.5 6.5 17.5 17.5"/><path d="M17.5 6.5 6.5 17.5"/>',
}

const icono = (nombre: keyof typeof ICONOS): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre]}</svg>`

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
  /** Qué versión de la batería suena. */
  kit: Kit
  entrenador: { activo: boolean; incremento: number; cadaCompases: number; bpmMeta: number }
  /** Ajuste fino de sincronía, en milisegundos (ver latenciaDeSalida). */
  sincronia: number
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
  kit: KIT_POR_DEFECTO,
  entrenador: { activo: false, incremento: 5, cadaCompases: 4, bpmMeta: 120 },
  sincronia: 0,
}

export function montarEjercicio(raiz: HTMLElement, id: string, desde = ''): () => void {
  // De dónde vino: si entraste desde una lección, el botón de volver regresa a
  // esa lección. Si no, a la lista de ejercicios.
  const atras = desde.startsWith('/') ? `#${desde}` : '#/ejercicios'

  const ejercicio = EJERCICIOS.find((e) => e.id === id)
  if (!ejercicio) {
    raiz.innerHTML = `
      <header class="barra"><a class="barra__volver" href="${atras}">‹ Volver</a></header>
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
  let porClave = new Map<string, NotaDibujada>()
  /** Dónde cae cada nota a lo largo de la tira, para deslizarla con la música. */
  let posiciones: { ticks: number; x: number }[] = []
  /**
   * Geometría de la tira: dónde empieza el primer compás de música (después
   * del bloque de clave y compás) y cuánto mide cada compás. Todos miden lo
   * mismo, así que con eso basta para colocar cualquier punto.
   */
  let geometria: { inicio: number; anchoCompas: number } | null = null

  /**
   * Dónde se queda el punto que suena dentro de la pantalla, como parte del
   * ancho. Se calcula al dibujar para que, parada, la tira empiece justo en
   * el borde (con la clave y el compás enteros) y al dar al play no se mueva.
   */
  let asomo = 0.2
  const cola: EventoReproduccion[] = []

  /**
   * El instante de la música que se está oyendo AHORA. Va por detrás del reloj
   * de audio: lo que se programa todavía tiene que salir por el altavoz. Sin
   * esto, la luz del cursor se adelanta al golpe, y con auriculares Bluetooth
   * se adelanta mucho.
   */
  function relojOido(): number {
    if (!contexto) return 0
    return contexto.currentTime - latenciaDeSalida(contexto) - prefs.sincronia / 1000
  }

  const piezasUsadas = new Set<Pieza>()
  for (const compas of ejercicio.compases) {
    for (const voz of ['manos', 'pies'] as const) {
      for (const nota of compas[voz]) for (const pieza of nota.piezas) piezasUsadas.add(pieza)
    }
  }

  // La pantalla del ejercicio va a sangre: sin márgenes ni ancho máximo.
  raiz.classList.add('app--completa')

  raiz.innerHTML = `
    <header class="barra-ejercicio">
      <a class="icono icono--discreto" href="${atras}" aria-label="Volver">
        ${icono('volver')}
      </a>

      <div class="tempo">
        <button class="tempo__paso" data-paso="-5">−5</button>
        <button class="tempo__paso" data-paso="-1">−1</button>
        <span class="tempo__valor"><strong id="bpm-numero">${bpm}</strong><small>BPM</small></span>
        <button class="tempo__paso" data-paso="1">+1</button>
        <button class="tempo__paso" data-paso="5">+5</button>
      </div>

      <button class="icono" id="abrir-ajustes" aria-label="Ajustes">${icono('ajustes')}</button>
    </header>

    <p class="estado-ejercicio" id="estado">
      <b class="compas">${ejercicio.compas.pulsos}/${ejercicio.compas.figura}</b>
      <span id="estado-texto">${ejercicio.descripcion}</span>
    </p>

    <main class="lienzo">
      <div class="hoja" id="hoja"></div>
    </main>

    <footer class="pie-ejercicio">
      <button class="icono icono--texto" id="loop" aria-pressed="${prefs.loop}">
        ${icono('bucle')}<span>Loop</span>
      </button>
      <button class="tocar" id="tocar" aria-label="Reproducir">${icono('tocar')}</button>
      <button class="icono icono--texto" id="pausa" aria-label="Pausa" disabled>
        ${icono('pausa')}<span>Pausa</span>
      </button>
    </footer>

    <dialog class="panel" id="ajustes">
      <div class="panel__barra">
        <strong>${ejercicio.titulo}</strong>
        <button class="icono" id="cerrar-ajustes" aria-label="Cerrar">${icono('cerrar')}</button>
      </div>
      <div class="panel__cuerpo">
        ${ejercicio.consejo ? `<p class="nota">💡 ${ejercicio.consejo}</p>` : ''}

        <div class="campos">
          <label class="campo">
            <span>Velocidad</span>
            <input type="range" class="rango" id="bpm-rango" min="${BPM_MINIMO}" max="${BPM_MAXIMO}"
                   value="${bpm}" aria-label="Velocidad en BPM" />
          </label>
          <label class="campo">
            <span>Sonido de la batería</span>
            <select id="kit">
              ${KITS.map(
                (k) => `<option value="${k.id}" ${prefs.kit === k.id ? 'selected' : ''}>${k.nombre}</option>`,
              ).join('')}
            </select>
          </label>
          <p class="nota" id="kit-descripcion"></p>

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

          <label class="campo campo--interruptor">
            <span>Entrenador de velocidad <small>sube solo hasta la meta</small></span>
            <input type="checkbox" id="ent-activo" ${prefs.entrenador.activo ? 'checked' : ''} />
          </label>
          <div class="campos campos--sangria" id="campos-entrenador">
            <label class="campo">
              <span>Sube</span>
              <input type="number" id="ent-incremento" min="1" max="20"
                     value="${prefs.entrenador.incremento}" /> <small>BPM</small>
            </label>
            <label class="campo">
              <span>Cada</span>
              <input type="number" id="ent-cada" min="1" max="32"
                     value="${prefs.entrenador.cadaCompases}" /> <small>compases</small>
            </label>
            <label class="campo">
              <span>Hasta</span>
              <input type="number" id="ent-meta" min="${BPM_MINIMO}" max="${BPM_MAXIMO}"
                     value="${prefs.entrenador.bpmMeta}" /> <small>BPM</small>
            </label>
          </div>
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
            <span>Ajuste de sincronía
              <small>si la luz se adelanta al golpe, súbelo</small></span>
            <input type="range" class="rango" id="sincronia" min="-50" max="400" step="5"
                   value="${prefs.sincronia}" />
          </label>
          <p class="nota" id="sincronia-valor"></p>

          <label class="campo">
            <span>Volumen del click</span>
            <input type="range" class="rango" id="vol-click" min="0" max="100"
                   value="${Math.round(prefs.volumenClick * 100)}" />
          </label>
        </div>

        <h3 class="panel__titulo">Qué es cada línea</h3>
        <div class="leyenda" id="leyenda"></div>
      </div>
    </dialog>
  `

  const $ = <T extends HTMLElement>(id: string): T => raiz.querySelector<T>('#' + id)!
  const hoja = $<HTMLDivElement>('hoja')
  const lienzo = raiz.querySelector<HTMLElement>('.lienzo')!
  const botonTocar = $<HTMLButtonElement>('tocar')
  const botonPausa = $<HTMLButtonElement>('pausa')
  const botonLoop = $<HTMLButtonElement>('loop')
  const bpmNumero = $<HTMLElement>('bpm-numero')
  const bpmRango = $<HTMLInputElement>('bpm-rango')
  const estado = $<HTMLElement>('estado-texto')
  const panel = $<HTMLDialogElement>('ajustes')

  // --- Partitura ---
  // VexFlow se descarga aparte, solo al abrir un ejercicio.
  let notacion: typeof import('../notacion/partitura') | null = null

  async function pintarPartitura(): Promise<void> {
    if (!notacion) {
      hoja.innerHTML = '<p class="cargando">Preparando la partitura…</p>'
      notacion = await import('../notacion/partitura')
    }
    const ancho = Math.max(280, lienzo.clientWidth - 16)
    const alto = Math.max(200, lienzo.clientHeight - 16)
    // Vista de práctica: todos los compases en una tira que avanza de lado,
    // en vez de saltar de renglón.
    notas = notacion.dibujarPartitura(hoja, ejercicio!, {
      ancho,
      alto,
      unaLinea: true,
      // Tres copias del ejercicio, una detrás de otra. La música se sigue
      // siempre en la del medio: así hay tira por delante y por detrás, el
      // deslizamiento nunca se topa con el borde y, al empezar otra vuelta,
      // el salto cae sobre música idéntica y no se ve.
      copias: 3,
      mostrarSticking: prefs.mostrarSticking,
      mostrarConteo: prefs.mostrarConteo,
    })
    porClave = new Map()
    for (const nota of notas) porClave.set(`${nota.compas}-${nota.voz}-${nota.indice}`, nota)
    medirPosiciones()
    vueltaNumerada = -1
    numerarCompases(0)
    // Parada, la tira enseña el principio de la partitura: la clave, el
    // compás y el primer golpe. El cursor arranca justo ahí, así que al dar
    // al play no se mueve nada.
    const inicio = xDeTicks(0) ?? 0
    asomo = Math.min(0.4, Math.max(0.12, inicio / lienzo.clientWidth))
    lienzo.scrollLeft = Math.max(0, inicio - lienzo.clientWidth * asomo)
  }

  async function pintarLeyenda(): Promise<void> {
    if (!notacion) notacion = await import('../notacion/partitura')
    notacion.dibujarLeyenda(
      $<HTMLDivElement>('leyenda'),
      ORDEN_LEYENDA.filter((p) => piezasUsadas.has(p)),
      NOMBRE_PIEZA,
      // Al tocar una pieza de la leyenda, suena.
      (pieza) => void sonarPieza(pieza),
    )
  }

  /** Hace sonar una pieza suelta, para oírla desde la leyenda. */
  async function sonarPieza(pieza: Pieza): Promise<void> {
    contexto = await desbloquearAudio()
    if (!haySonidosReales(prefs.kit)) await cargarBateria(contexto, prefs.kit)
    programarPieza(contexto, pieza, {
      cuando: contexto.currentTime + 0.02,
      volumen: prefs.volumenBateria,
    })
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
      // Cuenta corrida: sigue 1, 2, 3, 4, 5… vuelta tras vuelta, y solo
      // vuelve a empezar al darle a Stop.
      const compasCorrido = evento.vuelta * ejercicio!.compases.length + evento.compas + 1
      const partes = [`compás ${compasCorrido}`]
      if (prefs.escucharYTocar) partes.push(evento.soloClick ? 'tu turno' : 'escucha')
      estado.textContent = partes.join(' · ')
      return
    }

    numerarCompases(evento.vuelta)
    const compasDibujado = evento.compas + copiaDe(evento.vuelta) * ejercicio!.compases.length
    const nota = porClave.get(`${compasDibujado}-${evento.voz}-${evento.indice}`)
    if (!nota?.elemento) return

    hoja
      .querySelectorAll(`.sonando[data-voz="${evento.voz}"]`)
      .forEach((el) => el.classList.remove('sonando'))

    // Se encienden la nota y, con ella, su sticking y su conteo.
    for (const parte of [nota.elemento, ...nota.letreros]) {
      parte.setAttribute('data-voz', evento.voz ?? '')
      parte.classList.add('sonando')
    }
  }

  /**
   * Apunta en qué x de la tira cae cada nota. Se mide una vez, al dibujar,
   * y sirve para calcular en cada fotograma por dónde va la música.
   */
  function medirPosiciones(): void {
    // Medido respecto a la hoja, no a la pantalla: así no depende de por dónde
    // esté deslizada la tira en ese momento.
    const origenHoja = hoja.getBoundingClientRect().left
    const puntos = new Map<number, number>()
    for (const nota of notas) {
      if (!nota.elemento || puntos.has(nota.ticks)) continue
      const caja = nota.elemento.getBoundingClientRect()
      puntos.set(nota.ticks, caja.left + caja.width / 2 - origenHoja)
    }
    posiciones = [...puntos.entries()]
      .map(([ticks, x]) => ({ ticks, x }))
      .sort((a, b) => a.ticks - b.ticks)

    // El primer pentagrama dibujado es el bloque de clave y compás; la música
    // empieza en el siguiente.
    const compases = [...hoja.querySelectorAll('.vf-stave')].map(
      (el) => el.getBoundingClientRect().left - origenHoja,
    )
    geometria =
      compases.length >= 3
        ? { inicio: compases[1], anchoCompas: compases[2] - compases[1] }
        : null
  }

  /**
   * Dónde cae en la tira un punto cualquiera del ejercicio.
   * Como todos los compases miden lo mismo, es una cuenta directa: el tiempo
   * se convierte en distancia a paso constante. Antes se interpolaba entre
   * nota y nota y el cursor cambiaba de velocidad en cada compás.
   */
  function xDeTicks(ticks: number): number | null {
    if (!geometria) return posiciones.length > 0 ? posiciones[0].x : null
    const porCompas = ticksPorCompas(ejercicio!.compas)
    return geometria.inicio + (ticks / porCompas) * geometria.anchoCompas
  }

  /**
   * En qué copia de la tira se sigue la música.
   * La primera vuelta se toca en la copia 1, que es donde está el principio
   * de la partitura; de la segunda en adelante, en la del medio, que tiene
   * tira por delante y por detrás. El paso de una a otra es hacia adelante,
   * así que no se nota, y los saltos siguientes caen sobre el mismo dibujo.
   */
  const copiaDe = (vuelta: number): number => (vuelta === 0 ? 0 : 1)

  /**
   * Renumera los compases dibujados para que la cuenta sea corrida: al acabar
   * el compás 4 viene el 5, no otra vez el 1. Como la tira son tres copias del
   * ejercicio, cada vuelta se reparte así: la copia donde se está tocando
   * lleva los números de esta vuelta, la de antes los de la anterior y la de
   * después los de la siguiente.
   */
  let vueltaNumerada = -1
  function numerarCompases(vuelta: number): void {
    if (vuelta === vueltaNumerada) return
    vueltaNumerada = vuelta
    const cuantos = ejercicio!.compases.length
    const copiaActual = copiaDe(vuelta)
    const numeros = hoja.querySelectorAll('.numero-compas')
    numeros.forEach((elemento, indice) => {
      const copia = Math.floor(indice / cuantos)
      const dentro = indice % cuantos
      elemento.textContent = String((vuelta - copiaActual + copia) * cuantos + dentro + 1)
    })
  }

  /**
   * Desliza la tira pegada a la música, fotograma a fotograma, en vez de
   * saltar de compás en compás: la partitura avanza contigo.
   */
  function deslizarConLaMusica(): void {
    if (!contexto || !reproductor) return
    const absoluto = reproductor.posicionEnTicks(relojOido())
    if (absoluto === null) return

    const porVuelta = reproductor.ticksDeUnaVuelta()
    const vuelta = Math.floor(absoluto / porVuelta)
    const dentro = absoluto % porVuelta
    const x = xDeTicks(dentro + copiaDe(vuelta) * porVuelta)
    if (x === null) return

    // El punto que suena se queda cerca del borde izquierdo, dejando casi toda
    // la pantalla para lo que viene, que es lo que hace falta al leer. Se
    // coloca sin suavizado: la posición ya viene del reloj de audio, así que
    // el movimiento es continuo, y al cambiar de copia el salto cae sobre
    // música idéntica y no se nota.
    lienzo.scrollLeft = Math.max(0, x - lienzo.clientWidth * asomo)
  }

  function bucleVisual(): void {
    if (!contexto) return
    const ahora = relojOido()
    while (cola.length > 0 && cola[0].cuando <= ahora) pintarEvento(cola.shift()!)
    deslizarConLaMusica()

    // Sin bucle, el reproductor se para en cuanto programa el último golpe,
    // unos 100 ms antes de que suene. Aquí se sigue pintando hasta vaciar la
    // cola, para que el último golpe también se marque en la partitura.
    if (reproductor?.estaSonando() || cola.length > 0) {
      animacion = requestAnimationFrame(bucleVisual)
      return
    }
    if (!reproductor?.estaEnPausa()) {
      estado.textContent = ejercicio!.descripcion
      pintarTransporte()
    }
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
    entrenador: prefs.entrenador,
  })

  function guardarPrefs(): void {
    guardar(CLAVE_GUARDADO, prefs)
    reproductor?.actualizar(opcionesActuales())
  }

  /**
   * El botón grande es reproducir/detener. El de al lado, pausa: para sin
   * perder el sitio y vuelve a arrancar donde se quedó.
   */
  function pintarTransporte(): void {
    const sonando = reproductor?.estaSonando() ?? false
    const enPausa = reproductor?.estaEnPausa() ?? false
    botonTocar.innerHTML = icono(sonando || enPausa ? 'parar' : 'tocar')
    botonTocar.setAttribute('aria-label', sonando || enPausa ? 'Detener' : 'Reproducir')
    botonTocar.classList.toggle('tocar--parar', sonando || enPausa)
    botonPausa.disabled = !sonando && !enPausa
    botonPausa.classList.toggle('icono--activo', enPausa)
    botonPausa.querySelector('span')!.textContent = enPausa ? 'Seguir' : 'Pausa'
  }

  /** Para del todo y vuelve al principio. */
  function detener(): void {
    vueltaNumerada = -1
    reproductor?.detener()
    cancelAnimationFrame(animacion)
    cola.length = 0
    apagarCursor()
    estado.textContent = ejercicio!.descripcion
    void pintarPartitura()
    pintarTransporte()
    void soltarPantalla()
  }

  /** Botón grande: reproducir o detener del todo. */
  async function alternar(): Promise<void> {
    if (reproductor?.estaSonando() || reproductor?.estaEnPausa()) {
      detener()
      return
    }
    contexto = await desbloquearAudio()
    if (!haySonidosReales(prefs.kit)) {
      botonTocar.disabled = true
      botonTocar.classList.add('tocar--cargando')
      estado.textContent = 'Cargando la batería…'
      await cargarBateria(contexto, prefs.kit)
      botonTocar.classList.remove('tocar--cargando')
      botonTocar.disabled = false
    }
    reproductor = crearReproductor(contexto, ejercicio!, opcionesActuales())
    reproductor.alEvento((evento) => cola.push(evento))
    // Cuando el entrenador sube el tempo, el número de la barra lo sigue.
    reproductor.alCambiarBpm((nuevo) => {
      bpm = nuevo
      bpmNumero.textContent = String(nuevo)
      bpmRango.value = String(nuevo)
      guardar(`bpm:${ejercicio!.id}`, { bpm })
    })
    reproductor.iniciar()
    pintarTransporte()
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

  /** Pausa: se queda donde está y vuelve a arrancar en el mismo punto. */
  botonPausa.addEventListener('click', () => {
    if (!reproductor) return
    if (reproductor.estaSonando()) {
      reproductor.pausar()
      cancelAnimationFrame(animacion)
      cola.length = 0
      estado.textContent = 'En pausa'
    } else if (reproductor.estaEnPausa()) {
      reproductor.reanudar()
      animacion = requestAnimationFrame(bucleVisual)
    }
    pintarTransporte()
  })

  botonLoop.addEventListener('click', () => {
    prefs.loop = !prefs.loop
    botonLoop.setAttribute('aria-pressed', String(prefs.loop))
    botonLoop.classList.toggle('icono--activo', prefs.loop)
    guardarPrefs()
  })
  botonLoop.classList.toggle('icono--activo', prefs.loop)
  pintarTransporte()

  $<HTMLButtonElement>('abrir-ajustes').addEventListener('click', () => {
    panel.showModal()
    void pintarLeyenda()
  })
  $<HTMLButtonElement>('cerrar-ajustes').addEventListener('click', () => panel.close())
  // Tocar fuera del panel también lo cierra.
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.close()
  })

  raiz.querySelectorAll<HTMLButtonElement>('.tempo__paso').forEach((boton) => {
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
  casilla('ent-activo', (v) => {
    prefs.entrenador.activo = v
    $<HTMLElement>('campos-entrenador').hidden = !v
  })
  $<HTMLElement>('campos-entrenador').hidden = !prefs.entrenador.activo

  const numero = (id: string, asignar: (valor: number) => void): void => {
    const campo = $<HTMLInputElement>(id)
    campo.addEventListener('change', () => {
      const min = Number(campo.min)
      const max = Number(campo.max)
      const valor = Math.min(max, Math.max(min, Math.round(Number(campo.value) || min)))
      campo.value = String(valor)
      asignar(valor)
      guardarPrefs()
    })
  }
  numero('ent-incremento', (v) => (prefs.entrenador.incremento = v))
  numero('ent-cada', (v) => (prefs.entrenador.cadaCompases = v))
  numero('ent-meta', (v) => (prefs.entrenador.bpmMeta = v))
  casilla('ver-sticking', (v) => (prefs.mostrarSticking = v), true)
  casilla('ver-conteo', (v) => (prefs.mostrarConteo = v), true)

  // --- Sonido de la batería ---
  const kitDescripcion = $<HTMLElement>('kit-descripcion')
  function pintarKit(): void {
    kitDescripcion.textContent = KITS.find((k) => k.id === prefs.kit)?.descripcion ?? ''
  }
  pintarKit()

  $<HTMLSelectElement>('kit').addEventListener('change', async (e) => {
    prefs.kit = (e.target as HTMLSelectElement).value as Kit
    pintarKit()
    guardarPrefs()
    // Se cambia al vuelo: si está sonando, se para para no cortar a medias.
    if (reproductor?.estaSonando()) detener()
    if (contexto) {
      kitDescripcion.textContent = 'Cargando el kit…'
      await cargarBateria(contexto, prefs.kit)
      pintarKit()
    }
  })

  $<HTMLSelectElement>('entrada').addEventListener('change', (e) => {
    prefs.cuentaEntrada = Number((e.target as HTMLSelectElement).value) as 0 | 1 | 2
    guardarPrefs()
  })
  $<HTMLInputElement>('vol-bateria').addEventListener('input', (e) => {
    prefs.volumenBateria = Number((e.target as HTMLInputElement).value) / 100
    guardarPrefs()
  })
  const sincroniaValor = $<HTMLElement>('sincronia-valor')
  const pintarSincronia = (): void => {
    sincroniaValor.textContent =
      prefs.sincronia === 0 ? 'Sin ajuste' : `La luz espera ${prefs.sincronia} ms al golpe`
  }
  pintarSincronia()
  $<HTMLInputElement>('sincronia').addEventListener('input', (e) => {
    prefs.sincronia = Number((e.target as HTMLInputElement).value)
    pintarSincronia()
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
    raiz.classList.remove('app--completa')
    window.removeEventListener('resize', alCambiarTamano)
    clearTimeout(temporizadorAncho)
  }
}
