// Lista de ejercicios, agrupados por estilo.

import { EJERCICIOS } from '../ejercicios/catalogo'
import type { Estilo } from '../ejercicios/tipos'

const NOMBRE_ESTILO: Record<Estilo, string> = {
  lectura: 'Lectura',
  rock: 'Rock',
  funk: 'Funk',
  jazz: 'Jazz',
  blues: 'Blues',
  latino: 'Latino',
  metal: 'Metal y doble pedal',
  coordinacion: 'Coordinación',
  rudimentos: 'Rudimentos',
}

const ESTRELLAS = (nivel: number): string => '●'.repeat(nivel) + '○'.repeat(3 - nivel)

export function montarListaEjercicios(raiz: HTMLElement): void {
  // Agrupamos respetando el orden en que están escritos en el catálogo.
  const grupos = new Map<Estilo, typeof EJERCICIOS>()
  for (const ejercicio of EJERCICIOS) {
    const lista = grupos.get(ejercicio.estilo) ?? []
    lista.push(ejercicio)
    grupos.set(ejercicio.estilo, lista)
  }

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#">‹ Inicio</a>
      <span class="barra__titulo">Ejercicios</span>
    </header>

    <p class="nota">
      Cada ejercicio se ve en partitura y se escucha con la batería, junto al click.
      Puedes cambiar la velocidad y apagar las manos o los pies.
    </p>

    ${[...grupos.entries()]
      .map(
        ([estilo, lista]) => `
      <section class="tarjeta">
        <h2>${NOMBRE_ESTILO[estilo]}</h2>
        <div class="modulos">
          ${lista
            .map(
              (ejercicio) => `
            <a class="boton modulo modulo--listo" href="#/ejercicio/${ejercicio.id}">
              <span>${ejercicio.titulo}</span>
              <small>${ejercicio.descripcion}</small>
              <small class="nivel">${ESTRELLAS(ejercicio.nivel)} · ${ejercicio.bpmSugerido} BPM</small>
            </a>`,
            )
            .join('')}
        </div>
      </section>`,
      )
      .join('')}
  `
}
