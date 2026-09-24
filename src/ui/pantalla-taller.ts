// Taller: tus propias partituras.
//
// Abres una foto de la página que estés estudiando, la miras en pantalla y vas
// marcando en la rejilla lo que ves. Abajo se dibuja la partitura de verdad y
// se puede tocar, que es justo lo que no te da un libro: saber cómo suena.
//
// Todo se guarda en este teléfono y en ningún sitio más.

import { NOMBRE_PIEZA } from '../audio/bateria'
import type { Pieza } from '../ejercicios/tipos'
import {
  POR_COMPAS,
  POR_TIEMPO,
  rejillaAEjercicio,
  rejillaVacia,
} from '../taller/rejilla'
import {
  borrarPartitura,
  buscarPartitura,
  guardarPartitura,
  listarPartituras,
  nuevoId,
  type Partitura,
} from '../taller/almacen'

/** Las piezas que se ofrecen en la rejilla, de arriba abajo del pentagrama. */
const PIEZAS_TALLER: Pieza[] = [
  'crash',
  'ride',
  'hiHatCerrado',
  'tomAgudo',
  'tomMedio',
  'tarola',
  'tomPiso',
  'bombo',
  'hiHatPedal',
]

const PIEZAS_POR_DEFECTO: Pieza[] = ['hiHatCerrado', 'tarola', 'bombo']

// --- Lista de partituras guardadas ---

export function montarTaller(raiz: HTMLElement): () => void {
  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#">‹ Inicio</a>
      <span class="barra__titulo">Mis partituras</span>
    </header>

    <p class="nota">
      Copia aquí la página que estés estudiando y escúchala. Se guarda en este
      teléfono: la app no tiene servidor ni cuentas, así que no hay a dónde
      pueda salir, y no lleva botón de compartir.
    </p>

    <section class="tarjeta">
      <a class="boton boton--principal" href="#/taller/nueva">Nueva partitura</a>
    </section>

    <section class="tarjeta">
      <h2>Guardadas</h2>
      <div class="modulos" id="lista"><p class="nota">Cargando…</p></div>
    </section>
  `

  const lista = raiz.querySelector<HTMLDivElement>('#lista')!

  void (async () => {
    const todas = await listarPartituras()
    lista.innerHTML =
      todas.length === 0
        ? '<p class="nota">Todavía no has guardado ninguna.</p>'
        : todas
            .map(
              (p) => `
        <a class="boton modulo modulo--listo" href="#/taller/${p.id}">
          <span>${p.titulo}</span>
          <small>${p.rejilla.compases} ${p.rejilla.compases === 1 ? 'compás' : 'compases'} · ${p.bpm} BPM</small>
        </a>`,
            )
            .join('')
  })()

  return () => {}
}

// --- Editor ---

export function montarEditorTaller(raiz: HTMLElement, id: string): () => void {
  const esNueva = id === 'nueva'
  let partitura: Partitura = {
    id: esNueva ? nuevoId() : id,
    titulo: 'Sin título',
    cuando: Date.now(),
    bpm: 70,
    piezas: [...PIEZAS_POR_DEFECTO],
    rejilla: rejillaVacia(PIEZAS_POR_DEFECTO, 2),
  }
  let compasVisible = 0
  let urlImagen: string | null = null

  raiz.innerHTML = `
    <header class="barra">
      <a class="barra__volver" href="#/taller">‹ Mis partituras</a>
    </header>

    <section class="tarjeta">
      <input class="campo" id="titulo" type="text" placeholder="Título" />
      <div class="taller__foto" id="foto">
        <label class="boton" for="archivo">Abrir foto de la página</label>
        <input id="archivo" type="file" accept="image/*" hidden />
      </div>
    </section>

    <section class="tarjeta">
      <div class="taller__barra">
        <button class="boton boton--chico" id="compas-menos">‹</button>
        <span id="compas-cual">Compás 1 de 2</span>
        <button class="boton boton--chico" id="compas-mas">›</button>
      </div>
      <div class="taller__barra">
        <button class="boton boton--chico" id="quitar-compas">− compás</button>
        <button class="boton boton--chico" id="anadir-compas">+ compás</button>
        <button class="boton boton--chico" id="limpiar">Vaciar</button>
      </div>
      <div class="rejilla" id="rejilla"></div>
      <details class="detalle">
        <summary>Qué piezas aparecen</summary>
        <div class="piezas" id="piezas"></div>
      </details>
    </section>

    <section class="tarjeta">
      <h2>Como queda</h2>
      <div class="hoja" id="hoja"></div>
      <div class="taller__barra">
        <button class="boton boton--chico" id="bpm-menos">−5</button>
        <span id="bpm-cual">70 BPM</span>
        <button class="boton boton--chico" id="bpm-mas">+5</button>
      </div>
      <button class="boton boton--principal" id="guardar">Guardar</button>
      <a class="boton" id="tocar">Tocar</a>
      <button class="boton" id="borrar">Borrar</button>
    </section>
  `

  const campoTitulo = raiz.querySelector<HTMLInputElement>('#titulo')!
  const cajaRejilla = raiz.querySelector<HTMLDivElement>('#rejilla')!
  const cajaPiezas = raiz.querySelector<HTMLDivElement>('#piezas')!
  const hoja = raiz.querySelector<HTMLDivElement>('#hoja')!
  const cajaFoto = raiz.querySelector<HTMLDivElement>('#foto')!
  const cualCompas = raiz.querySelector<HTMLSpanElement>('#compas-cual')!
  const cualBpm = raiz.querySelector<HTMLSpanElement>('#bpm-cual')!
  const tocar = raiz.querySelector<HTMLAnchorElement>('#tocar')!

  // --- Dibujo de la rejilla ---
  function pintarRejilla(): void {
    const base = compasVisible * POR_COMPAS
    cajaRejilla.innerHTML = partitura.rejilla.filas
      .map(
        (fila, f) => `
      <div class="rejilla__fila">
        <span class="rejilla__nombre">${NOMBRE_PIEZA[fila.pieza]}</span>
        <div class="rejilla__casillas">
          ${Array.from({ length: POR_COMPAS }, (_, i) => {
            const encendida = fila.casillas[base + i]
            const inicioDeTiempo = i % POR_TIEMPO === 0
            return `<button class="casilla${encendida ? ' casilla--on' : ''}${
              inicioDeTiempo ? ' casilla--tiempo' : ''
            }" data-fila="${f}" data-casilla="${base + i}" aria-label="${
              NOMBRE_PIEZA[fila.pieza]
            }, casilla ${i + 1}"></button>`
          }).join('')}
        </div>
      </div>`,
      )
      .join('')

    cualCompas.textContent = `Compás ${compasVisible + 1} de ${partitura.rejilla.compases}`
  }

  function pintarPiezas(): void {
    cajaPiezas.innerHTML = PIEZAS_TALLER.map(
      (pieza) => `
      <label class="pieza">
        <input type="checkbox" data-pieza="${pieza}" ${
          partitura.piezas.includes(pieza) ? 'checked' : ''
        } />
        <span>${NOMBRE_PIEZA[pieza]}</span>
      </label>`,
    ).join('')
  }

  // --- Dibujo de la partitura (VexFlow se descarga aparte) ---
  let pintando = false
  async function pintarHoja(): Promise<void> {
    if (pintando) return
    pintando = true
    const { dibujarPartitura } = await import('../notacion/partitura')
    dibujarPartitura(hoja, ejercicio(), { ancho: Math.max(280, hoja.clientWidth) })
    pintando = false
  }

  const ejercicio = () =>
    rejillaAEjercicio(partitura.id, partitura.titulo, partitura.rejilla, partitura.bpm)

  /** Rehace las filas cuando cambian las piezas o el número de compases. */
  function rehacerRejilla(piezas: Pieza[], compases: number): void {
    const nueva = rejillaVacia(piezas, compases)
    // Se conserva lo ya marcado de las piezas que siguen estando.
    for (const fila of nueva.filas) {
      const vieja = partitura.rejilla.filas.find((f) => f.pieza === fila.pieza)
      if (vieja) {
        for (let i = 0; i < Math.min(fila.casillas.length, vieja.casillas.length); i++) {
          fila.casillas[i] = vieja.casillas[i]
        }
      }
    }
    partitura.piezas = piezas
    partitura.rejilla = nueva
    if (compasVisible >= compases) compasVisible = compases - 1
  }

  function refrescar(): void {
    pintarRejilla()
    void pintarHoja()
    tocar.href = `#/ejercicio/${partitura.id}?desde=/taller/${partitura.id}`
  }

  // --- Cargar lo guardado ---
  void (async () => {
    if (!esNueva) {
      const guardada = await buscarPartitura(id)
      if (guardada) {
        partitura = guardada
        if (guardada.imagen) {
          urlImagen = URL.createObjectURL(guardada.imagen)
          mostrarFoto(urlImagen)
        }
      }
    }
    campoTitulo.value = partitura.titulo
    cualBpm.textContent = `${partitura.bpm} BPM`
    pintarPiezas()
    refrescar()
  })()

  function mostrarFoto(url: string): void {
    const vieja = cajaFoto.querySelector('img')
    if (vieja) vieja.remove()
    const img = document.createElement('img')
    img.src = url
    img.className = 'taller__imagen'
    img.alt = 'La página que estás copiando'
    cajaFoto.prepend(img)
  }

  // --- Toques ---
  cajaRejilla.addEventListener('click', (evento) => {
    const casilla = (evento.target as HTMLElement).closest<HTMLButtonElement>('.casilla')
    if (!casilla) return
    const fila = partitura.rejilla.filas[Number(casilla.dataset.fila)]
    const i = Number(casilla.dataset.casilla)
    fila.casillas[i] = !fila.casillas[i]
    casilla.classList.toggle('casilla--on', fila.casillas[i])
    void pintarHoja()
  })

  cajaPiezas.addEventListener('change', () => {
    const marcadas = PIEZAS_TALLER.filter(
      (pieza) =>
        cajaPiezas.querySelector<HTMLInputElement>(`input[data-pieza="${pieza}"]`)?.checked,
    )
    rehacerRejilla(marcadas.length > 0 ? marcadas : [...PIEZAS_POR_DEFECTO], partitura.rejilla.compases)
    if (marcadas.length === 0) pintarPiezas()
    refrescar()
  })

  campoTitulo.addEventListener('input', () => {
    partitura.titulo = campoTitulo.value || 'Sin título'
  })

  raiz.querySelector('#compas-menos')!.addEventListener('click', () => {
    compasVisible = Math.max(0, compasVisible - 1)
    pintarRejilla()
  })
  raiz.querySelector('#compas-mas')!.addEventListener('click', () => {
    compasVisible = Math.min(partitura.rejilla.compases - 1, compasVisible + 1)
    pintarRejilla()
  })
  raiz.querySelector('#anadir-compas')!.addEventListener('click', () => {
    rehacerRejilla(partitura.piezas, Math.min(16, partitura.rejilla.compases + 1))
    compasVisible = partitura.rejilla.compases - 1
    refrescar()
  })
  raiz.querySelector('#quitar-compas')!.addEventListener('click', () => {
    rehacerRejilla(partitura.piezas, Math.max(1, partitura.rejilla.compases - 1))
    refrescar()
  })
  raiz.querySelector('#limpiar')!.addEventListener('click', () => {
    // Vaciar de verdad: rehacerRejilla conserva lo marcado, aquí no queremos eso.
    partitura.rejilla = rejillaVacia(partitura.piezas, partitura.rejilla.compases)
    refrescar()
  })

  raiz.querySelector('#bpm-menos')!.addEventListener('click', () => {
    partitura.bpm = Math.max(30, partitura.bpm - 5)
    cualBpm.textContent = `${partitura.bpm} BPM`
  })
  raiz.querySelector('#bpm-mas')!.addEventListener('click', () => {
    partitura.bpm = Math.min(300, partitura.bpm + 5)
    cualBpm.textContent = `${partitura.bpm} BPM`
  })

  raiz.querySelector<HTMLInputElement>('#archivo')!.addEventListener('change', (evento) => {
    const archivo = (evento.target as HTMLInputElement).files?.[0]
    if (!archivo) return
    partitura.imagen = archivo
    if (urlImagen) URL.revokeObjectURL(urlImagen)
    urlImagen = URL.createObjectURL(archivo)
    mostrarFoto(urlImagen)
  })

  const guardar = raiz.querySelector<HTMLButtonElement>('#guardar')!
  guardar.addEventListener('click', () => {
    void (async () => {
      partitura.cuando = Date.now()
      await guardarPartitura(partitura)
      guardar.textContent = '✓ Guardada'
      window.setTimeout(() => (guardar.textContent = 'Guardar'), 1200)
    })()
  })

  raiz.querySelector('#borrar')!.addEventListener('click', () => {
    void (async () => {
      await borrarPartitura(partitura.id)
      location.hash = '#/taller'
    })()
  })

  return () => {
    if (urlImagen) URL.revokeObjectURL(urlImagen)
  }
}
