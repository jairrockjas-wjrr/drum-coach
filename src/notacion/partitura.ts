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
  Stave,
  StaveNote,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow/bravura'
import type { Ejercicio, Nota } from '../ejercicios/tipos'
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

  const { ancho, mostrarSticking = true, mostrarConteo = true } = opciones
  const porPulso = ticksPorPulso(ejercicio.compas)
  const ticksCompas = ejercicio.compas.pulsos * porPulso

  // Cuántos compases caben por renglón según el ancho y lo apretada que esté la música.
  const notasPorCompas = Math.max(
    ...ejercicio.compases.map((c) => Math.max(c.manos.length, c.pies.length)),
  )
  // Cada nota necesita su aire para que se lean el sticking y el conteo debajo.
  const ANCHO_POR_NOTA = 30
  const MARGEN_IZQ = 10
  const MARGEN_ARRIBA = 24
  const ALTO_RENGLON = 118

  const disponible = ancho - 70 // lo que se llevan la clave y los márgenes
  const porRenglon =
    [4, 2, 1].find((cuantos) => notasPorCompas * ANCHO_POR_NOTA * cuantos <= disponible) ?? 1

  const renglones = Math.ceil(ejercicio.compases.length / porRenglon)
  const extraPrimero = 62

  // Ancho que la música necesita de verdad. Si no cabe en la pantalla, el
  // dibujo entero se escala al final: siempre se ve el compás completo, nunca
  // hay que arrastrar la partitura de lado.
  const anchoCompasBase = Math.max(
    notasPorCompas * ANCHO_POR_NOTA,
    (ancho - MARGEN_IZQ * 2 - extraPrimero) / porRenglon,
  )
  const anchoLienzo = MARGEN_IZQ * 2 + extraPrimero + anchoCompasBase * porRenglon
  const altoLienzo = MARGEN_ARRIBA + renglones * ALTO_RENGLON + 16

  const renderizador = new Renderer(contenedor, Renderer.Backends.SVG)
  renderizador.resize(anchoLienzo, altoLienzo)
  const ctx = renderizador.getContext()

  // Guardamos también la nota de VexFlow para poder rescatar su SVG al final.
  const dibujadas: (NotaDibujada & { vex: StaveNote })[] = []
  let ticksAcumulados = 0

  for (let renglon = 0; renglon < renglones; renglon++) {
    const desde = renglon * porRenglon
    const hasta = Math.min(desde + porRenglon, ejercicio.compases.length)
    const compasesDelRenglon = hasta - desde

    // El primer compás del renglón lleva la clave (y el compás, si es el primero de todos).
    void compasesDelRenglon
    let x = MARGEN_IZQ
    const y = MARGEN_ARRIBA + renglon * ALTO_RENGLON

    for (let i = desde; i < hasta; i++) {
      const esPrimeroDelRenglon = i === desde
      const anchoCompas = anchoCompasBase + (esPrimeroDelRenglon ? extraPrimero : 0)
      const stave = new Stave(x, y, anchoCompas)

      if (esPrimeroDelRenglon) {
        stave.addClef('percussion')
        if (renglon === 0) {
          stave.addTimeSignature(`${ejercicio.compas.pulsos}/${ejercicio.compas.figura}`)
        }
      }
      stave.setMeasure(i + 1)
      stave.setContext(ctx).draw()

      const compas = ejercicio.compases[i]
      const voces: Voice[] = []
      // Sticking y conteo: se pintan a mano, en dos filas debajo del pentagrama.
      const letrerosDelCompas: { x: () => number; conteo: string; mano: string }[] = []
      const adornos: { setContext: (c: typeof ctx) => { draw: () => void } }[] = []

      for (const voz of ['manos', 'pies'] as const) {
        const notas = compas[voz]
        if (notas.length === 0) continue

        let ticksEnCompas = 0
        const letreros: { x: () => number; conteo: string; mano: string }[] = []
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
        if (voz === 'manos') letrerosDelCompas.push(...letreros)

        const vozVex = new Voice({
          numBeats: ejercicio.compas.pulsos,
          beatValue: ejercicio.compas.figura,
        })
        vozVex.setMode(Voice.Mode.SOFT)
        vozVex.addTickables(vexNotas)
        voces.push(vozVex)

        for (const barra of Beam.generateBeams(vexNotas)) adornos.push(barra)
        for (const tresillo of armarTresillos(notas, vexNotas)) adornos.push(tresillo)
      }

      if (voces.length > 0) {
        const formateador = new Formatter()
        if (voces.length > 1) formateador.joinVoices(voces)
        formateador.format(voces, anchoCompas - (esPrimeroDelRenglon ? extraPrimero + 18 : 24))
        for (const voz of voces) voz.draw(ctx, stave)
        for (const adorno of adornos) adorno.setContext(ctx).draw()

        // Filas de texto: primero el sticking, debajo el conteo.
        // Desde la línea de abajo del pentagrama, no desde getBottomY(),
        // que deja demasiado aire y acercaba el texto al renglón siguiente.
        const yBase = stave.getYForLine(4)
        ctx.save()
        for (const letrero of letrerosDelCompas) {
          const x = letrero.x()
          if (letrero.mano) {
            ctx.setFont('system-ui, sans-serif', 11, 'bold')
            ctx.setFillStyle('#1f2937')
            ctx.fillText(letrero.mano, x - 3, yBase + 22)
          }
          if (letrero.conteo) {
            ctx.setFont('system-ui, sans-serif', 11, 'normal')
            ctx.setFillStyle('#9aa3b2')
            ctx.fillText(letrero.conteo, x - 3, yBase + 38)
          }
        }
        ctx.restore()
      }

      ticksAcumulados += ticksCompas
      x += anchoCompas
    }
  }

  // Si el dibujo salió más ancho que la pantalla, se escala para que quepa
  // entero (con viewBox el SVG se encoge sin perder nitidez).
  const svg = contenedor.querySelector('svg')
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${anchoLienzo} ${altoLienzo}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet')
    svg.setAttribute('width', '100%')
    svg.removeAttribute('height')
    svg.style.height = 'auto'
  }

  // Ya dibujadas, rescatamos el elemento SVG de cada nota para poder
  // encenderla cuando suene (el cursor).
  return dibujadas
    .map(({ vex, ...resto }) => ({ ...resto, elemento: vex.getSVGElement() }))
    .sort((a, b) => a.ticks - b.ticks)
}
