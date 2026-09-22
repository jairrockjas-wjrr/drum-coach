// Motor del metrónomo: scheduler de lookahead.
//
// Cómo funciona y por qué no se desfasa:
//  - Un temporizador despierta cada 25 ms. No hace sonar nada: solo *programa*
//    por adelantado todos los clicks que caen en los próximos 100 ms.
//  - Cada click se programa con un instante exacto del reloj de audio
//    (audioContext.currentTime), que corre en el hilo de audio y no se ve
//    afectado por lo que pase en la pantalla.
//  - El tiempo del siguiente pulso se calcula sumando la duración del pulso al
//    anterior, no leyendo el reloj: aunque el temporizador llegue tarde, los
//    clicks ya estaban programados en el instante correcto.
//  Si el temporizador se retrasara más de 100 ms (pestaña en segundo plano),
//  se notaría; por eso la ventana es holgada frente a la revisión de 25 ms.

import { programarClick } from '../audio/click'
import { fraccionesDelPulso, tipoDeClick } from './patron'
import type { ConfigMetronomo, EventoMetronomo } from './tipos'
import { BPM_MAXIMO, BPM_MINIMO } from './tipos'

/** Cada cuánto despierta el temporizador a revisar. */
const REVISION_MS = 25
/** Cuánto tiempo hacia adelante se programa en cada revisión. */
const VENTANA_S = 0.1

export interface Motor {
  iniciar(): void
  detener(): void
  estaSonando(): boolean
  /**
   * Cambia la configuración en caliente. Recibe una copia, no el objeto de la
   * pantalla: así el motor siempre sabe qué cambió y no se le escapa nada.
   * No toca el tempo mientras suena; para eso está cambiarBpm().
   */
  actualizar(config: ConfigMetronomo): void
  /** Cambia el tempo mientras suena. Entra al empezar el siguiente pulso. */
  cambiarBpm(nuevo: number): void
  configActual(): ConfigMetronomo
  /** BPM que suena ahora mismo (puede diferir del configurado por el entrenador). */
  bpmActual(): number
  /** Se llama con cada evento programado, para que la pantalla se sincronice. */
  alEvento(escucha: (evento: EventoMetronomo) => void): void
}

export function crearMotor(contexto: AudioContext, configInicial: ConfigMetronomo): Motor {
  let config = configInicial
  let sonando = false
  let temporizador: number | null = null
  let escucha: ((evento: EventoMetronomo) => void) | null = null

  // --- Estado del recorrido ---
  let bpm = configInicial.bpm
  let bpmPendiente: number | null = null // los cambios de BPM entran en el siguiente pulso
  let tiempoPulso = 0 // instante (reloj de audio) en que empezó el pulso actual
  let tiempoEvento = 0 // instante del próximo click a programar
  let pulso = 0
  let subdivision = 0
  let compas = 0
  let entradaRestante = 0
  let compasesDesdeSubida = 0

  const duracionPulso = (): number => 60 / bpm

  const limitar = (valor: number): number =>
    Math.min(BPM_MAXIMO, Math.max(BPM_MINIMO, Math.round(valor)))

  const enCuentaEntrada = (): boolean => entradaRestante > 0

  /** ¿Este compás debe sonar, o toca quedarse en silencio? */
  const compasSuena = (): boolean => {
    if (enCuentaEntrada()) return true
    const { activo, sonando: conClick, callados } = config.silencio
    if (!activo || callados <= 0) return true
    const ciclo = Math.max(1, conClick + callados)
    return compas % ciclo < conClick
  }

  /** Avanza el entrenador de velocidad al empezar un compás nuevo. */
  const avanzarEntrenador = (): void => {
    const ent = config.entrenador
    if (!ent.activo) return
    compasesDesdeSubida++
    if (compasesDesdeSubida < Math.max(1, ent.cadaCompases)) return
    compasesDesdeSubida = 0
    const meta = Math.min(BPM_MAXIMO, ent.bpmMeta)
    const siguiente = Math.min(meta, bpm + ent.incremento)
    if (siguiente !== bpm) bpmPendiente = siguiente
  }

  /** Calcula el instante del siguiente click. */
  const avanzar = (): void => {
    const fracciones = fraccionesDelPulso(config.subdivision, config.swing)
    subdivision++

    if (subdivision < fracciones.length) {
      tiempoEvento = tiempoPulso + fracciones[subdivision] * duracionPulso()
      return
    }

    // Empieza un pulso nuevo.
    subdivision = 0
    tiempoPulso += duracionPulso()

    // Los cambios de BPM (del usuario o del entrenador) entran aquí, nunca a media nota.
    if (bpmPendiente !== null) {
      bpm = bpmPendiente
      bpmPendiente = null
    }

    pulso++
    if (pulso >= config.compas.pulsos) {
      pulso = 0
      if (entradaRestante > 0) {
        entradaRestante--
        if (entradaRestante === 0) compas = 0
      } else {
        compas++
        avanzarEntrenador()
      }
    }
    tiempoEvento = tiempoPulso
  }

  /** Programa todos los clicks que caen dentro de la ventana de lookahead. */
  const revisar = (): void => {
    const limite = contexto.currentTime + VENTANA_S
    while (sonando && tiempoEvento < limite) {
      const entrada = enCuentaEntrada()
      const tipo = tipoDeClick(config, pulso, subdivision, entrada)
      const suena = compasSuena() && tipo !== null

      if (suena && tipo) {
        programarClick(contexto, { cuando: tiempoEvento, tipo, volumen: config.volumen })
      }

      escucha?.({
        cuando: tiempoEvento,
        tipo: suena && tipo ? tipo : 'silencio',
        pulso,
        subdivision,
        compas,
        enCuentaEntrada: entrada,
        bpm,
      })

      avanzar()
    }
  }

  return {
    iniciar(): void {
      if (sonando) return
      sonando = true
      bpm = limitar(config.bpm)
      bpmPendiente = null
      pulso = 0
      subdivision = 0
      compas = 0
      compasesDesdeSubida = 0
      entradaRestante = config.cuentaEntrada
      // Pequeño margen para que el primer click no llegue tarde.
      tiempoPulso = contexto.currentTime + 0.12
      tiempoEvento = tiempoPulso
      revisar()
      temporizador = window.setInterval(revisar, REVISION_MS)
    },

    detener(): void {
      sonando = false
      if (temporizador !== null) {
        clearInterval(temporizador)
        temporizador = null
      }
    },

    estaSonando: () => sonando,

    actualizar(nueva: ConfigMetronomo): void {
      config = nueva
      // Mientras suena, el tempo solo cambia por cambiarBpm() o por el
      // entrenador; así un ajuste cualquiera no borra la subida del entrenador.
      if (!sonando) bpm = limitar(nueva.bpm)
    },

    cambiarBpm(nuevo: number): void {
      const valor = limitar(nuevo)
      if (sonando) bpmPendiente = valor
      else bpm = valor
    },

    configActual: () => config,
    bpmActual: () => bpm,
    alEvento(nuevaEscucha): void {
      escucha = nuevaEscucha
    },
  }
}
