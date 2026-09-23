// Dibuja un ejercicio en un pentagrama de percusión, con VexFlow.
//
// Devuelve además un mapa de las notas dibujadas para que el reproductor
// pueda encender la que está sonando (el cursor).

import {
  Annotation,
  Articulation,
  Beam,
  Dot,
  Formatter,
  Renderer,
  type RenderContext,
  Stave,
  StaveNote,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow/bravura'
import type { Ejercicio, Nota, Pieza } from '../ejercicios/tipos'
import { esSilencio, ticksDeNota, ticksPorPulso } from '../ejercicios/tipos'
import { SITIO } from './piezas'

/** Código de duración de VexFlow para cada figura. */
const DURACION: Record<string, string> = {
  redonda: 'w',
  blanca: 'h',
  negra: 'q',
  corchea: '8',
  semicorchea: '16',
  fusa: '32',
}

export type Voz = 'manos' | 'pies'

/** Una nota ya dibujada, para poder encenderla cuando suene. */
export interface NotaDibujada {
  compas: number
  voz: Voz
  indice: number
  /** Inicio de la nota en ticks desde el comienzo del ejercicio. */
  ticks: number
  elemento?: SVGElement
}

export interface OpcionesPartitura {
  ancho: number
  /** Alto disponible en pantalla. Si se indica, la música se agranda para llenarlo. */
  alto?: number
  mostrarSticking?: boolean
  mostrarConteo?: boolean
}

/** Sílaba con la que se cuenta una nota según dónde cae dentro del pulso. */
export function conteoDeNota(nota: Nota, ticksEnElCompas: number, porPulso: number): string {
  const pulso = Math.floor(ticksEnElCompas / porPulso)
  const dentro = ticksEnElCompas % porPulso
  if (dentro === 0) return String(pulso + 1)

  if (nota.tresillo) {
    // Hay que distinguir el tresillo de corcheas (tres notas por pulso) del
    // seisillo (seis), porque las sílabas caen en sitios distintos.
    const dura = ticksDeNota(nota)
    const tabla: Record<number, string> =
      dura === 8
        ? { 8: 'la', 16: 'li' } // 1 la li
        : { 4: 'la', 8: 'li', 12: 'y', 16: 'la', 20: 'li' } // 1 la li y la li
    return tabla[dentro] ?? ''
  }

  const tabla: Record<number, string> = { 6: 'e', 12: 'y', 18: 'a' }
  return tabla[dentro] ?? ''
}

/** Convierte una nota nuestra en una nota de VexFlow. */
function crearNotaVex(nota: Nota, voz: Voz): StaveNote {
  const duracion = DURACION[nota.figura]
  const haciaArriba = voz === 'manos'

  const vex = esSilencio(nota)
    ? new StaveNote({
        // Los silencios se escriben en medio del pentagrama.
        keys: [haciaArriba ? 'c/5' : 'f/4'],
        duration: duracion + 'r',
      })
    : new StaveNote({
        keys: nota.piezas.map((pieza) => SITIO[pieza].clave),
        duration: duracion,
        stemDirection: haciaArriba ? Stem.UP : Stem.DOWN,
      })

  if (nota.puntillo) Dot.buildAndAttach([vex])

  if (!esSilencio(nota)) {
    // El rimshot se escribe como tarola acentuada.
    if (nota.piezas.includes('tarolaAro') || nota.acento) {
      vex.addModifier(new Articulation('a>').setPosition(haciaArriba ? 3 : 4), 0)
    }
    // El hi-hat abierto lleva un círculo encima.
    if (nota.piezas.includes('hiHatAbierto')) {
      vex.addModifier(
        new Annotation('o').setVerticalJustification(Annotation.VerticalJustify.TOP),
        0,
      )
    }
  }

  return vex
}

/** Agrupa los tresillos de tres en tres para dibujar su corchete. */
function armarTresillos(notas: Nota[], vexNotas: StaveNote[]): Tuplet[] {
  const tresillos: Tuplet[] = []
  let grupo: StaveNote[] = []
  notas.forEach((nota, i) => {
    if (nota.tresillo) {
      grupo.push(vexNotas[i])
      if (grupo.length === 3) {
        tresillos.push(new Tuplet(grupo, { numNotes: 3, notesOccupied: 2 }))
        grupo = []
      }
    } else {
      grupo = []
    }
  })
  return tresillos
}

/**
 * Dibuja el ejercicio completo dentro del contenedor y devuelve las notas
 * dibujadas, en orden de tiempo.
 */
export function dibujarPartitura(
  contenedor: HTMLDivElement,
  ejercicio: Ejercicio,
  opciones: OpcionesPartitura,
): NotaDibujada[] {
  contenedor.innerHTML = ''

  const { ancho, alto, mostrarSticking = true, mostrarConteo = true } = opciones
  const porPulso = ticksPorPulso(ejercicio.compas)
  const ticksCompas = ejercicio.compas.pulsos * porPulso

  const MARGEN_IZQ = 10
  const MARGEN_ARRIBA = 24
  const ALTO_RENGLON = 118
  const EXTRA_PRIMERO = 62 // lo que ocupan la clave y el compás
  const AIRE = 34 // espacio de respeto a cada lado de la música

  // --- Primera pasada: armar la música y preguntarle a VexFlow cuánto sitio
  // necesita de verdad. Antes lo estimaba a ojo y la música se salía del papel.
  interface CompasArmado {
    voces: Voice[]
    adornos: { setContext: (c: RenderContext) => { draw: () => void } }[]
    letreros: { x: () => number; conteo: string; mano: string }[]
    minimo: number
  }

  const dibujadas: (NotaDibujada & { vex: StaveNote })[] = []
  let ticksAcumulados = 0

  const armados: CompasArmado[] = ejercicio.compases.map((compas, i) => {
    const voces: Voice[] = []
    const adornos: CompasArmado['adornos'] = []
    const letreros: CompasArmado['letreros'] = []

    for (const voz of ['manos', 'pies'] as const) {
      const notas = compas[voz]
      if (notas.length === 0) continue

      let ticksEnCompas = 0
      const vexNotas = notas.map((nota, indice) => {
        const vex = crearNotaVex(nota, voz)
        if (voz === 'manos') {
          letreros.push({
            x: () => vex.getAbsoluteX(),
            conteo: mostrarConteo ? conteoDeNota(nota, ticksEnCompas, porPulso) : '',
            mano: mostrarSticking && nota.mano && !esSilencio(nota) ? nota.mano : '',
          })
        }
        dibujadas.push({ compas: i, voz, indice, ticks: ticksAcumulados + ticksEnCompas, vex })
        ticksEnCompas += ticksDeNota(nota)
        return vex
      })

      // Los tresillos se agrupan ANTES de meter las notas en la voz: agrupar
      // cambia la duración real de cada nota, y si se hace después, VexFlow
      // ya contó mal el tiempo y desalinea esta voz respecto a la otra.
      const tresillos = armarTresillos(notas, vexNotas)

      const vozVex = new Voice({
        numBeats: ejercicio.compas.pulsos,
        beatValue: ejercicio.compas.figura,
      })
      vozVex.setMode(Voice.Mode.SOFT)
      vozVex.addTickables(vexNotas)
      voces.push(vozVex)

      for (const barra of Beam.generateBeams(vexNotas)) adornos.push(barra)
      for (const tresillo of tresillos) adornos.push(tresillo)
    }

    ticksAcumulados += ticksCompas

    let minimo = 0
    if (voces.length > 0) {
      const medidor = new Formatter()
      if (voces.length > 1) medidor.joinVoices(voces)
      minimo = medidor.preCalculateMinTotalWidth(voces)
    }
    return { voces, adornos, letreros, minimo }
  })

  // --- Reparto: cuántos compases por renglón ---
  // Cuantos menos compases por renglón, más grandes salen las notas. Así que
  // se elige el reparto que más las agranda sin que la partitura se salga de
  // alto. Si no sabemos el alto, se busca simplemente que quepa a lo ancho.
  const anchoCompasNecesario = Math.max(...armados.map((a) => a.minimo)) + AIRE
  const util = ancho - MARGEN_IZQ * 2 - EXTRA_PRIMERO

  const medir = (cuantos: number) => {
    const anchoCompasBase = Math.max(anchoCompasNecesario, util / cuantos)
    const renglones = Math.ceil(ejercicio.compases.length / cuantos)
    const anchoLienzo = MARGEN_IZQ * 2 + EXTRA_PRIMERO + anchoCompasBase * cuantos
    const escala = ancho / anchoLienzo
    const altoNecesario = (MARGEN_ARRIBA + renglones * ALTO_RENGLON + 16) * escala
    return { cuantos, anchoCompasBase, renglones, anchoLienzo, escala, altoNecesario }
  }

  const opcionesReparto = [1, 2, 4].map(medir)
  const porRenglon = alto
    ? // El primero (menos compases por renglón = notas más grandes) que quepa de alto.
      (opcionesReparto.find((o) => o.altoNecesario <= alto) ?? opcionesReparto[opcionesReparto.length - 1])
        .cuantos
    : ([4, 2, 1].find((cuantos) => anchoCompasNecesario * cuantos <= util * 1.2) ?? 1)

  const elegido = medir(porRenglon)
  const { anchoCompasBase, renglones, anchoLienzo } = elegido

  // Si sobra alto, los renglones se separan un poco y el bloque se centra,
  // para que la partitura ocupe la hoja sin quedar apretada arriba.
  let altoRenglon = ALTO_RENGLON
  let altoLienzo = MARGEN_ARRIBA + renglones * altoRenglon + 16
  let desplazamiento = 0
  if (alto) {
    const disponible = alto / elegido.escala
    altoRenglon = Math.min(200, Math.max(ALTO_RENGLON, (disponible - MARGEN_ARRIBA - 16) / renglones))
    const usado = MARGEN_ARRIBA + renglones * altoRenglon + 16
    altoLienzo = Math.max(usado, disponible)
    desplazamiento = Math.max(0, (altoLienzo - usado) / 2)
  }

  const renderizador = new Renderer(contenedor, Renderer.Backends.SVG)
  renderizador.resize(anchoLienzo, altoLienzo)
  const ctx = renderizador.getContext()

  // --- Segunda pasada: dibujar ---
  for (let renglon = 0; renglon < renglones; renglon++) {
    const desde = renglon * porRenglon
    const hasta = Math.min(desde + porRenglon, ejercicio.compases.length)
    let x = MARGEN_IZQ
    const y = MARGEN_ARRIBA + desplazamiento + renglon * altoRenglon

    for (let i = desde; i < hasta; i++) {
      const esPrimeroDelRenglon = i === desde
      const anchoCompas = anchoCompasBase + (esPrimeroDelRenglon ? EXTRA_PRIMERO : 0)
      const stave = new Stave(x, y, anchoCompas)

      if (esPrimeroDelRenglon) {
        stave.addClef('percussion')
        if (renglon === 0) {
          stave.addTimeSignature(`${ejercicio.compas.pulsos}/${ejercicio.compas.figura}`)
        }
      }
      stave.setMeasure(i + 1)
      stave.setContext(ctx).draw()

      const { voces, adornos, letreros } = armados[i]
      if (voces.length === 0) {
        x += anchoCompas
        continue
      }

      const formateador = new Formatter()
      if (voces.length > 1) formateador.joinVoices(voces)
      formateador.format(voces, anchoCompas - (esPrimeroDelRenglon ? EXTRA_PRIMERO + 18 : 18))
      for (const voz of voces) voz.draw(ctx, stave)
      for (const adorno of adornos) adorno.setContext(ctx).draw()

      // Filas de texto: primero el sticking, debajo el conteo.
      const yBase = stave.getYForLine(4)
      ctx.save()
      for (const letrero of letreros) {
        const posX = letrero.x()
        if (letrero.mano) {
          ctx.setFont('system-ui, sans-serif', 11, 'bold')
          ctx.setFillStyle('#1f2937')
          ctx.fillText(letrero.mano, posX - 3, yBase + 22)
        }
        if (letrero.conteo) {
          ctx.setFont('system-ui, sans-serif', 11, 'normal')
          ctx.setFillStyle('#9aa3b2')
          ctx.fillText(letrero.conteo, posX - 3, yBase + 38)
        }
      }
      ctx.restore()

      x += anchoCompas
    }
  }

  // El dibujo se adapta al hueco que tenga: con viewBox llena el ancho y, si
  // sobra alto (pantalla del ejercicio), crece hasta llenarlo también.
  const svg = contenedor.querySelector('svg')
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${anchoLienzo} ${altoLienzo}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.setAttribute('width', '100%')
    svg.removeAttribute('height')
  }

  // Ya dibujadas, rescatamos el elemento SVG de cada nota para poder
  // encenderla cuando suene (el cursor).
  return dibujadas
    .map(({ vex, ...resto }) => ({ ...resto, elemento: vex.getSVGElement() }))
    .sort((a, b) => a.ticks - b.ticks)
}

/**
 * Dibuja la leyenda: un mini pentagrama por pieza, mostrando cómo se escribe
 * de verdad, en vez de explicarlo con palabras.
 */
export function dibujarLeyenda(contenedor: HTMLDivElement, piezas: Pieza[], nombres: Record<Pieza, string>): void {
  contenedor.innerHTML = ''

  for (const pieza of piezas) {
    const fila = document.createElement('div')
    fila.className = 'leyenda__fila'

    const dibujo = document.createElement('div')
    dibujo.className = 'leyenda__dibujo'
    fila.append(dibujo)

    const texto = document.createElement('span')
    texto.textContent = nombres[pieza]
    fila.append(texto)
    contenedor.append(fila)

    const ANCHO = 92
    const ALTO = 96
    const renderizador = new Renderer(dibujo, Renderer.Backends.SVG)
    renderizador.resize(ANCHO, ALTO)
    const ctx = renderizador.getContext()

    const stave = new Stave(2, 18, ANCHO - 6)
    stave.setContext(ctx).draw()

    const esDePie = pieza === 'bombo' || pieza === 'hiHatPedal'
    const nota = new StaveNote({
      keys: [SITIO[pieza].clave],
      duration: 'q',
      stemDirection: esDePie ? Stem.DOWN : Stem.UP,
    })
    if (pieza === 'tarolaAro') nota.addModifier(new Articulation('a>').setPosition(3), 0)
    if (pieza === 'hiHatAbierto') {
      nota.addModifier(new Annotation('o').setVerticalJustification(Annotation.VerticalJustify.TOP), 0)
    }

    const voz = new Voice({ numBeats: 1, beatValue: 4 })
    voz.setMode(Voice.Mode.SOFT)
    voz.addTickables([nota])
    new Formatter().format([voz], ANCHO - 44)
    voz.draw(ctx, stave)

    const svg = dibujo.querySelector('svg')
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${ANCHO} ${ALTO}`)
      svg.setAttribute('width', '100%')
      svg.removeAttribute('height')
    }
  }
}
