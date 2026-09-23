// Ruta de lecciones de lectura, en orden, con las que ya has dado marcadas.

import { LECCIONES } from '../lecciones/catalogo'
import { leer } from '../datos/preferencias'

export const CLAVE_HECHAS = 'lecciones'

export interface Hechas {
  [id: string]: boolean
}

export function montarLectura(raiz: HTMLElement): void {
  const hechas = leer<Hechas>(CLAVE_HECHAS, {})
  const cuantas = LECCIONES.filter((l) => hechas[l.id]).length

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#">‹ Inicio</a>
      <span class="barra__titulo">Lectura desde cero</span>
    </header>

    <p class="nota">
      ${LECCIONES.length} lecciones en orden, de no saber nada a leer un groove entero.
      Cada una explica una idea, te la deja oír y trae debajo sus propios
      ejercicios. No hace falta salir a ningún otro sitio.
      ${cuantas > 0 ? `Llevas <strong>${cuantas} de ${LECCIONES.length}</strong>.` : ''}
    </p>

    <section class="tarjeta">
      <div class="modulos">
        ${LECCIONES.map(
          (leccion) => `
          <a class="boton modulo modulo--listo" href="#/leccion/${leccion.id}">
            <span>${hechas[leccion.id] ? '✓ ' : ''}${leccion.titulo}</span>
            <small>${leccion.resumen}</small>
          </a>`,
        ).join('')}
      </div>
    </section>
  `
}
