// Pantalla del metrónomo.
// Arriba lo que se ve mientras tocas (BPM, pulsos y play/stop gigante);
// abajo, en un panel que se abre, todos los ajustes finos.

import { desbloquearAudio } from '../audio/contexto'
import { crearMotor, type Motor } from '../metronomo/motor'
import { fraccionesDelPulso } from '../metronomo/patron'
import {
  BPM_MAXIMO,
  BPM_MINIMO,
  COMPASES,
  CONFIG_POR_DEFECTO,
  SUBDIVISIONES,
  type ConfigMetronomo,
  type EventoMetronomo,
  type Subdivision,
} from '../metronomo/tipos'
import { guardar, leer } from '../datos/preferencias'
import { mantenerPantallaEncendida, soltarPantalla } from '../sistema/wake-lock'

const CLAVE_GUARDADO = 'metronomo'

/**
 * Cómo se cuenta en voz alta cada subdivisión. La primera casilla es el pulso
 * (ahí va el número del tiempo), las demás son las sílabas de en medio.
 * Es el sistema "1 e y a" para semicorcheas y "1 la li" para tresillos.
 */
const CONTEOS: Record<Subdivision, string[]> = {
  1: [''],
  2: ['', 'y'],
  3: ['', 'la', 'li'],
  4: ['', 'e', 'y', 'a'],
  6: ['', 'la', 'li', 'y', 'la', 'li'],
}

/** Con más bolitas que esto no caben en la pantalla: se muestran solo los pulsos. */
const MAXIMO_MARCAS = 32

/**
 * Píxeles que representa un pulso completo al separar las bolitas.
 * Con pocas notas por pulso se usa más espacio, para que el corrimiento del
 * swing se vea bien; con muchas se aprieta para que quepan en la pantalla.
 */
function espacioPorPulso(subdivision: Subdivision): number {
  if (subdivision <= 2) return 62
  if (subdivision === 3) return 44
  return 30
}

export function montarMetronomo(raiz: HTMLElement, volver: () => void): () => void {
  let config = leer<ConfigMetronomo>(CLAVE_GUARDADO, CONFIG_POR_DEFECTO)
  let motor: Motor | null = null
  let contexto: AudioContext | null = null
  let animacion = 0
  let bpmMostrado = config.bpm
  let arrastrandoBpm = false
  const cola: EventoMetronomo[] = []

  raiz.innerHTML = `
    <header class="barra">
      <button class="barra__volver" id="volver" aria-label="Volver al inicio">‹ Inicio</button>
      <span class="barra__titulo">Metrónomo</span>
    </header>

    <section class="tarjeta practica">
      <div class="bpm">
        <button class="bpm__paso" data-paso="-5">−5</button>
        <button class="bpm__paso" data-paso="-1">−1</button>
        <div class="bpm__valor">
          <strong id="bpm-numero">${config.bpm}</strong>
          <small id="bpm-unidad">BPM</small>
        </div>
        <button class="bpm__paso" data-paso="1">+1</button>
        <button class="bpm__paso" data-paso="5">+5</button>
      </div>

      <input class="rango" type="range" id="bpm-rango"
             min="${BPM_MINIMO}" max="${BPM_MAXIMO}" step="1" value="${config.bpm}"
             aria-label="Velocidad en BPM" />

      <div class="pulsos" id="pulsos"></div>
      <p class="leyenda" id="leyenda-conteo"></p>

      <div class="acciones">
        <button class="boton boton--principal" id="tocar">Empezar</button>
        <button class="boton" id="tap">Tap tempo</button>
      </div>

      <p class="nota" id="estado-practica"></p>
    </section>

    <details class="tarjeta detalle" id="ajustes">
      <summary>Ajustes</summary>
      <div class="campos">
        <label class="campo">
          <span>Compás</span>
          <select id="compas">
            ${COMPASES.map(
              (c) =>
                `<option value="${c.etiqueta}" ${
                  c.compas.pulsos === config.compas.pulsos && c.compas.figura === config.compas.figura
                    ? 'selected'
                    : ''
                }>${c.etiqueta}</option>`,
            ).join('')}
          </select>
        </label>

        <label class="campo">
          <span>Subdivisión</span>
          <select id="subdivision">
            ${SUBDIVISIONES.map(
              (s) =>
                `<option value="${s.valor}" ${s.valor === config.subdivision ? 'selected' : ''}>${
                  s.etiqueta
                }</option>`,
            ).join('')}
          </select>
        </label>

        <label class="campo" id="campo-swing">
          <span>Swing <small id="swing-valor">${textoSwing(config.swing)}</small></span>
          <input type="range" id="swing" class="rango" min="50" max="75" step="1" value="${config.swing}" />
        </label>

        <label class="campo campo--interruptor">
          <span>Acento en el 1</span>
          <input type="checkbox" id="acento" ${config.acentoEnUno ? 'checked' : ''} />
        </label>

        <label class="campo campo--interruptor" id="campo-dos-cuatro">
          <span>Click solo en 2 y 4 <small>jazz · solo en 4/4</small></span>
          <input type="checkbox" id="dos-cuatro" ${config.soloDosYCuatro ? 'checked' : ''} />
        </label>

        <label class="campo">
          <span>Cuenta de entrada</span>
          <select id="entrada">
            <option value="0" ${config.cuentaEntrada === 0 ? 'selected' : ''}>Sin cuenta</option>
            <option value="1" ${config.cuentaEntrada === 1 ? 'selected' : ''}>1 compás</option>
            <option value="2" ${config.cuentaEntrada === 2 ? 'selected' : ''}>2 compases</option>
          </select>
        </label>

        <label class="campo campo--interruptor">
          <span>Entrenador de velocidad <small>sube solo hasta la meta</small></span>
          <input type="checkbox" id="ent-activo" ${config.entrenador.activo ? 'checked' : ''} />
        </label>
        <div class="campos campos--sangria" id="campos-entrenador">
          <label class="campo">
            <span>Sube</span>
            <input type="number" id="ent-incremento" min="1" max="20" value="${config.entrenador.incremento}" /> <small>BPM</small>
          </label>
          <label class="campo">
            <span>Cada</span>
            <input type="number" id="ent-cada" min="1" max="32" value="${config.entrenador.cadaCompases}" /> <small>compases</small>
          </label>
          <label class="campo">
            <span>Hasta</span>
            <input type="number" id="ent-meta" min="${BPM_MINIMO}" max="${BPM_MAXIMO}" value="${config.entrenador.bpmMeta}" /> <small>BPM</small>
          </label>
        </div>

        <label class="campo campo--interruptor">
          <span>Compases en silencio <small>prueba tu tiempo interno</small></span>
          <input type="checkbox" id="sil-activo" ${config.silencio.activo ? 'checked' : ''} />
        </label>
        <div class="campos campos--sangria" id="campos-silencio">
          <label class="campo">
            <span>Suenan</span>
            <input type="number" id="sil-sonando" min="1" max="16" value="${config.silencio.sonando}" /> <small>compases</small>
          </label>
          <label class="campo">
            <span>Callan</span>
            <input type="number" id="sil-callados" min="1" max="16" value="${config.silencio.callados}" /> <small>compases</small>
          </label>
        </div>

        <label class="campo">
          <span>Volumen del click</span>
          <input type="range" id="volumen" class="rango" min="0" max="100" step="1" value="${Math.round(
            config.volumen * 100,
          )}" />
        </label>
      </div>
    </details>
  `

  // --- Atajos a los elementos ---
  const $ = <T extends HTMLElement>(id: string): T => raiz.querySelector<T>('#' + id)!
  const bpmNumero = $<HTMLElement>('bpm-numero')
  const bpmUnidad = $<HTMLElement>('bpm-unidad')
  const bpmRango = $<HTMLInputElement>('bpm-rango')
  const pulsosCaja = $<HTMLElement>('pulsos')
  const botonTocar = $<HTMLButtonElement>('tocar')
  const estadoPractica = $<HTMLElement>('estado-practica')

  // --- Dibujo del conteo del compás ---
  // Bolita grande = pulso (lleva el número del tiempo).
  // Bolita chica = subdivisión, con la sílaba con que se cuenta.
  // La separación entre bolitas es proporcional al tiempo real que hay entre
  // ellas, así que con swing la sílaba de en medio se ve correrse hacia la derecha.
  function dibujarPulsos(): void {
    const fracciones = fraccionesDelPulso(config.subdivision, config.swing)
    const conteo = CONTEOS[config.subdivision]
    const caben = config.compas.pulsos * fracciones.length <= MAXIMO_MARCAS

    pulsosCaja.innerHTML = Array.from({ length: config.compas.pulsos }, (_, pulso) => {
      const marcas = caben
        ? fracciones
            .map((fraccion, sub) => {
              const separacion =
                sub === 0 ? 0 : (fraccion - fracciones[sub - 1]) * espacioPorPulso(config.subdivision)
              const clase = sub === 0 ? 'marca marca--pulso' : 'marca marca--sub'
              const texto = sub === 0 ? String(pulso + 1) : conteo[sub]
              return `<span class="${clase}" data-pulso="${pulso}" data-sub="${sub}"
                            style="margin-left:${separacion.toFixed(1)}px">${texto}</span>`
            })
            .join('')
        : `<span class="marca marca--pulso" data-pulso="${pulso}" data-sub="0">${pulso + 1}</span>`
      return `<div class="grupo">${marcas}</div>`
    }).join('')

    // Debajo, el conteo escrito para leerlo mientras tocas.
    const leyenda = raiz.querySelector<HTMLElement>('#leyenda-conteo')
    if (leyenda) {
      if (config.subdivision === 1) {
        leyenda.textContent = ''
      } else if (caben) {
        leyenda.textContent = `Se cuenta: 1 ${conteo.slice(1).join(' ')} · 2 ${conteo
          .slice(1)
          .join(' ')} …`
      } else {
        leyenda.textContent = 'Son demasiadas notas para dibujarlas: se marcan solo los pulsos.'
      }
    }
  }

  function pintarPulso(evento: EventoMetronomo): void {
    const actual = pulsosCaja.querySelector(
      `[data-pulso="${evento.pulso}"][data-sub="${evento.subdivision}"]`,
    )
    // Si esa bolita no está dibujada (compás muy lleno), dejamos encendida la anterior.
    if (actual) {
      pulsosCaja.querySelectorAll('.marca--activa').forEach((m) => m.classList.remove('marca--activa'))
      actual.classList.add('marca--activa')
    }

    // El texto de estado solo cambia una vez por pulso.
    if (evento.subdivision !== 0) return

    const partes: string[] = []
    if (evento.enCuentaEntrada) partes.push('Cuenta de entrada…')
    else partes.push(`Compás ${evento.compas + 1}`)
    if (evento.tipo === 'silencio' && !config.soloDosYCuatro) partes.push('compás mudo')
    if (config.entrenador.activo) {
      partes.push(
        evento.bpm >= config.entrenador.bpmMeta
          ? `meta alcanzada: ${evento.bpm} BPM`
          : `${evento.bpm} → ${config.entrenador.bpmMeta} BPM`,
      )
    }
    estadoPractica.textContent = partes.join(' · ')

    // Solo el entrenador de velocidad puede mover el BPM por su cuenta.
    if (config.entrenador.activo && evento.bpm !== bpmMostrado) mostrarBpm(evento.bpm)
  }

  // --- Sincronía pantalla/audio: los eventos se pintan cuando el audio los toca ---
  function bucleVisual(): void {
    if (!contexto || !motor?.estaSonando()) return
    const ahora = contexto.currentTime
    while (cola.length > 0 && cola[0].cuando <= ahora) pintarPulso(cola.shift()!)
    animacion = requestAnimationFrame(bucleVisual)
  }

  // --- Cambios de configuración ---
  function aplicarConfig(guardarCambios = true): void {
    bpmNumero.textContent = String(config.bpm)
    bpmRango.value = String(config.bpm)
    bpmUnidad.textContent = config.compas.figura === 8 ? 'BPM (corcheas)' : 'BPM'

    // El swing solo tiene sentido con corcheas.
    $<HTMLElement>('campo-swing').hidden = config.subdivision !== 2
    $<HTMLElement>('swing-valor').textContent = textoSwing(config.swing)

    // El modo 2 y 4 solo existe en 4/4.
    const es44 = config.compas.pulsos === 4 && config.compas.figura === 4
    const casillaDosCuatro = $<HTMLInputElement>('dos-cuatro')
    casillaDosCuatro.disabled = !es44
    $<HTMLElement>('campo-dos-cuatro').classList.toggle('campo--apagado', !es44)
    if (!es44 && config.soloDosYCuatro) {
      config.soloDosYCuatro = false
      casillaDosCuatro.checked = false
    }

    $<HTMLElement>('campos-entrenador').hidden = !config.entrenador.activo
    $<HTMLElement>('campos-silencio').hidden = !config.silencio.activo

    dibujarPulsos()
    motor?.actualizar(structuredClone(config))
    if (guardarCambios) guardar(CLAVE_GUARDADO, config)
  }

  function cambiarBpm(nuevo: number): void {
    config.bpm = Math.min(BPM_MAXIMO, Math.max(BPM_MINIMO, Math.round(nuevo)))
    mostrarBpm(config.bpm)
    motor?.actualizar(structuredClone(config))
    motor?.cambiarBpm(config.bpm)
    guardar(CLAVE_GUARDADO, config)
  }

  /**
   * Escribe el BPM en pantalla. Mientras arrastras el deslizador no lo movemos
   * por debajo: el número lo mandas tú, salvo cuando el entrenador sube solo.
   */
  function mostrarBpm(valor: number): void {
    bpmMostrado = valor
    bpmNumero.textContent = String(valor)
    if (!arrastrandoBpm) bpmRango.value = String(valor)
  }

  // --- Empezar / detener ---
  async function alternar(): Promise<void> {
    if (motor?.estaSonando()) {
      motor.detener()
      cancelAnimationFrame(animacion)
      cola.length = 0
      botonTocar.textContent = 'Empezar'
      botonTocar.classList.remove('boton--parar')
      pulsosCaja.querySelectorAll('.marca--activa').forEach((m) => m.classList.remove('marca--activa'))
      estadoPractica.textContent = ''
      void soltarPantalla()
      sessionStorage.setItem('drum-coach:pantalla-encendida', 'no')
      return
    }

    // El audio solo puede arrancar dentro del toque del usuario.
    contexto = await desbloquearAudio()
    if (!motor) {
      motor = crearMotor(contexto, structuredClone(config))
      // Se encolan todas las notas (pulsos y subdivisiones) para iluminar el conteo.
      motor.alEvento((evento) => cola.push(evento))
    }
    motor.actualizar(structuredClone(config))
    motor.iniciar()
    botonTocar.textContent = 'Detener'
    botonTocar.classList.add('boton--parar')
    animacion = requestAnimationFrame(bucleVisual)

    const ok = await mantenerPantallaEncendida()
    sessionStorage.setItem('drum-coach:pantalla-encendida', ok ? 'si' : 'no')
  }

  // --- Tap tempo ---
  let toques: number[] = []
  function tapTempo(): void {
    const ahora = performance.now()
    // Si pasaron más de 2,5 s, empezamos a contar de nuevo.
    if (toques.length > 0 && ahora - toques[toques.length - 1] > 2500) toques = []
    toques.push(ahora)
    if (toques.length > 5) toques.shift()
    if (toques.length < 2) {
      estadoPractica.textContent = 'Sigue tocando el pulso…'
      return
    }
    const intervalos = toques.slice(1).map((t, i) => t - toques[i])
    const promedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length
    cambiarBpm(60000 / promedio)
    estadoPractica.textContent = `Tap tempo: ${config.bpm} BPM`
  }

  // --- Conexiones de la interfaz ---
  $<HTMLButtonElement>('volver').addEventListener('click', volver)
  botonTocar.addEventListener('click', () => void alternar())
  $<HTMLButtonElement>('tap').addEventListener('click', tapTempo)

  raiz.querySelectorAll<HTMLButtonElement>('.bpm__paso').forEach((boton) => {
    boton.addEventListener('click', () => cambiarBpm(config.bpm + Number(boton.dataset.paso)))
  })
  bpmRango.addEventListener('input', () => cambiarBpm(Number(bpmRango.value)))
  bpmRango.addEventListener('pointerdown', () => (arrastrandoBpm = true))
  for (const evento of ['pointerup', 'pointercancel', 'blur']) {
    bpmRango.addEventListener(evento, () => (arrastrandoBpm = false))
  }

  $<HTMLSelectElement>('compas').addEventListener('change', (e) => {
    const etiqueta = (e.target as HTMLSelectElement).value
    const elegido = COMPASES.find((c) => c.etiqueta === etiqueta)
    if (elegido) config.compas = { ...elegido.compas }
    aplicarConfig()
  })

  $<HTMLSelectElement>('subdivision').addEventListener('change', (e) => {
    config.subdivision = Number((e.target as HTMLSelectElement).value) as Subdivision
    aplicarConfig()
  })

  $<HTMLInputElement>('swing').addEventListener('input', (e) => {
    config.swing = Number((e.target as HTMLInputElement).value)
    aplicarConfig()
  })

  $<HTMLInputElement>('acento').addEventListener('change', (e) => {
    config.acentoEnUno = (e.target as HTMLInputElement).checked
    aplicarConfig()
  })

  $<HTMLInputElement>('dos-cuatro').addEventListener('change', (e) => {
    config.soloDosYCuatro = (e.target as HTMLInputElement).checked
    aplicarConfig()
  })

  $<HTMLSelectElement>('entrada').addEventListener('change', (e) => {
    config.cuentaEntrada = Number((e.target as HTMLSelectElement).value) as 0 | 1 | 2
    aplicarConfig()
  })

  $<HTMLInputElement>('ent-activo').addEventListener('change', (e) => {
    config.entrenador.activo = (e.target as HTMLInputElement).checked
    aplicarConfig()
  })
  numero('ent-incremento', (v) => (config.entrenador.incremento = v))
  numero('ent-cada', (v) => (config.entrenador.cadaCompases = v))
  numero('ent-meta', (v) => (config.entrenador.bpmMeta = v))

  $<HTMLInputElement>('sil-activo').addEventListener('change', (e) => {
    config.silencio.activo = (e.target as HTMLInputElement).checked
    aplicarConfig()
  })
  numero('sil-sonando', (v) => (config.silencio.sonando = v))
  numero('sil-callados', (v) => (config.silencio.callados = v))

  $<HTMLInputElement>('volumen').addEventListener('input', (e) => {
    config.volumen = Number((e.target as HTMLInputElement).value) / 100
    aplicarConfig()
  })

  function numero(id: string, asignar: (valor: number) => void): void {
    const campo = $<HTMLInputElement>(id)
    campo.addEventListener('change', () => {
      const min = Number(campo.min)
      const max = Number(campo.max)
      const valor = Math.min(max, Math.max(min, Math.round(Number(campo.value) || min)))
      campo.value = String(valor)
      asignar(valor)
      aplicarConfig()
    })
  }

  aplicarConfig(false)

  // Función de limpieza: se llama al salir de la pantalla.
  return () => {
    motor?.detener()
    cancelAnimationFrame(animacion)
    void soltarPantalla()
  }
}

function textoSwing(valor: number): string {
  if (valor === 50) return 'recto'
  if (valor >= 66 && valor <= 68) return 'tresillo'
  return `${valor} %`
}
