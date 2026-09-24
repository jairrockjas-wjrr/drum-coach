// Lector de fotos de partitura: intenta sacar de una imagen dónde están los
// renglones, las barras de compás y las cabezas de nota.
//
// No es un lector de partituras de propósito general: eso es un problema
// enorme y con foto de celular falla. Aquí se apunta al caso que de verdad
// importa para practicar: notación de batería en una sola línea, impresa y
// bastante recta. Lo que salga se deja en la rejilla, que el usuario corrige.
//
// Todo pasa dentro del teléfono: son cuentas sobre los píxeles, sin red.

/** Un punto de tinta: 1 = oscuro (tinta), 0 = papel. */
export type Mapa = { ancho: number; alto: number; tinta: Uint8Array }

/** Convierte la imagen a blanco y negro decidiendo el umbral con Otsu. */
export function binarizar(datos: ImageData): Mapa {
  const { width: ancho, height: alto, data } = datos
  const grises = new Uint8Array(ancho * alto)
  const histograma = new Uint32Array(256)

  for (let i = 0; i < ancho * alto; i++) {
    // Luminancia de toda la vida: el verde pesa más porque el ojo lo ve más.
    const gris =
      (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000
    grises[i] = gris
    histograma[Math.round(gris)]++
  }

  const umbral = otsu(histograma, ancho * alto)
  const tinta = new Uint8Array(ancho * alto)
  for (let i = 0; i < grises.length; i++) tinta[i] = grises[i] < umbral ? 1 : 0
  return { ancho, alto, tinta }
}

/**
 * Umbral de Otsu: el corte entre claro y oscuro que deja los dos grupos lo
 * más separados posible. Va bien con papel blanco y tinta negra aunque la
 * foto esté floja de luz.
 */
function otsu(histograma: Uint32Array, total: number): number {
  let suma = 0
  for (let i = 0; i < 256; i++) suma += i * histograma[i]

  let sumaFondo = 0
  let pesoFondo = 0
  let mejorVarianza = -1
  let mejorUmbral = 128

  for (let u = 0; u < 256; u++) {
    pesoFondo += histograma[u]
    if (pesoFondo === 0) continue
    const pesoFrente = total - pesoFondo
    if (pesoFrente === 0) break

    sumaFondo += u * histograma[u]
    const mediaFondo = sumaFondo / pesoFondo
    const mediaFrente = (suma - sumaFondo) / pesoFrente
    const varianza = pesoFondo * pesoFrente * (mediaFondo - mediaFrente) ** 2

    if (varianza > mejorVarianza) {
      mejorVarianza = varianza
      mejorUmbral = u
    }
  }
  return mejorUmbral
}

/** Cuenta de tinta por fila, que es lo que delata las líneas del pentagrama. */
function tintaPorFila(mapa: Mapa): Uint32Array {
  const cuenta = new Uint32Array(mapa.alto)
  for (let y = 0; y < mapa.alto; y++) {
    let n = 0
    const base = y * mapa.ancho
    for (let x = 0; x < mapa.ancho; x++) n += mapa.tinta[base + x]
    cuenta[y] = n
  }
  return cuenta
}

export interface Renglon {
  /** Y del centro de cada una de las cinco líneas, de arriba abajo. */
  lineas: number[]
  /** Separación media entre líneas. */
  separacion: number
  /** Dónde empieza y acaba la tinta del renglón. */
  x0: number
  x1: number
}

/**
 * Busca los renglones: filas con mucha tinta seguida son líneas de pentagrama,
 * y cinco líneas a distancias parecidas son un renglón.
 */
export function buscarRenglones(mapa: Mapa): Renglon[] {
  const cuenta = tintaPorFila(mapa)
  // Una línea de pentagrama cruza casi todo el ancho de la música, pero no de
  // la página: hay hojas con los renglones metidos hacia dentro y más cortos.
  // Así que el listón se pone sobre la fila con más tinta de toda la imagen,
  // no sobre el ancho, que es lo que dejaba fuera hojas enteras.
  let masTinta = 0
  for (let y = 0; y < mapa.alto; y++) if (cuenta[y] > masTinta) masTinta = cuenta[y]
  const minimo = Math.max(mapa.ancho * 0.25, masTinta * 0.6)

  // Filas con mucha tinta, agrupadas: una línea impresa ocupa varios píxeles.
  const franjas: { centro: number; grosor: number }[] = []
  let desde = -1
  for (let y = 0; y < mapa.alto; y++) {
    const llena = cuenta[y] >= minimo
    if (llena && desde === -1) desde = y
    if ((!llena || y === mapa.alto - 1) && desde !== -1) {
      const hasta = llena ? y : y - 1
      franjas.push({ centro: (desde + hasta) / 2, grosor: hasta - desde + 1 })
      desde = -1
    }
  }

  // Cinco franjas seguidas a distancias parecidas: eso es un renglón.
  const renglones: Renglon[] = []
  for (let i = 0; i + 4 < franjas.length; ) {
    const cinco = franjas.slice(i, i + 5)
    const huecos = cinco.slice(1).map((f, j) => f.centro - cinco[j].centro)
    const media = huecos.reduce((a, b) => a + b, 0) / huecos.length
    const parejo = huecos.every((h) => Math.abs(h - media) <= Math.max(2, media * 0.35))

    if (parejo && media > 3) {
      const lineas = cinco.map((f) => f.centro)
      const { x0, x1 } = extremos(mapa, lineas[0], lineas[4])
      renglones.push({ lineas, separacion: media, x0, x1 })
      i += 5
    } else {
      i++
    }
  }
  return renglones
}

/** Dónde empieza y acaba la tinta de un renglón, a lo ancho. */
function extremos(mapa: Mapa, arriba: number, abajo: number): { x0: number; x1: number } {
  const y0 = Math.round(arriba)
  const y1 = Math.round(abajo)
  let x0 = mapa.ancho
  let x1 = 0
  for (let y = y0; y <= y1; y++) {
    const base = y * mapa.ancho
    for (let x = 0; x < mapa.ancho; x++) {
      if (mapa.tinta[base + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
      }
    }
  }
  return { x0, x1: Math.max(x1, x0) }
}

/**
 * Barras de compás: columnas de tinta que cruzan el pentagrama de arriba abajo
 * y son estrechas. Las plicas también cruzan tinta, pero no llegan a las cinco
 * líneas enteras, y por eso se pide el recorrido completo.
 */
export function buscarBarras(mapa: Mapa, renglon: Renglon): number[] {
  const arriba = Math.round(renglon.lineas[0])
  const abajo = Math.round(renglon.lineas[4])
  const alto = abajo - arriba + 1

  const columnas: number[] = []
  for (let x = renglon.x0; x <= renglon.x1; x++) {
    let tinta = 0
    for (let y = arriba; y <= abajo; y++) tinta += mapa.tinta[y * mapa.ancho + x]
    // Casi toda la columna con tinta: o es barra, o es una plica muy larga.
    if (tinta >= alto * 0.92) columnas.push(x)
  }

  // Columnas pegadas son la misma barra (y las dobles, dos juntas).
  const barras: number[] = []
  let grupo: number[] = []
  for (const x of columnas) {
    if (grupo.length === 0 || x - grupo[grupo.length - 1] <= renglon.separacion * 0.8) {
      grupo.push(x)
    } else {
      barras.push(grupo.reduce((a, b) => a + b, 0) / grupo.length)
      grupo = [x]
    }
  }
  if (grupo.length > 0) barras.push(grupo.reduce((a, b) => a + b, 0) / grupo.length)
  return barras
}

export interface Cabeza {
  x: number
  y: number
  ancho: number
  alto: number
  /** Cuánto de su recuadro está pintado: una redonda rellena ~0.8, una x ~0.45. */
  relleno: number
  /** En qué línea o espacio cae, contando medios espacios desde la línea de arriba. */
  posicion: number
}

/**
 * Cabezas de nota: manchas de tinta del tamaño de una cabeza, una vez quitadas
 * las líneas del pentagrama.
 *
 * Quitar las líneas es imprescindible: si no, todas las notas de un renglón
 * quedan pegadas entre sí por la línea que las cruza y salen como una sola
 * mancha del ancho de la página.
 */
export function buscarCabezas(mapa: Mapa, renglon: Renglon, desdeX = 0): Cabeza[] {
  const limpio = quitarPalos(quitarLineas(mapa, renglon), renglon)

  // Se mira un poco por encima y por debajo: ahí van los platillos y el bombo.
  const margen = renglon.separacion * 3
  const y0 = Math.max(0, Math.round(renglon.lineas[0] - margen))
  const y1 = Math.min(mapa.alto - 1, Math.round(renglon.lineas[4] + margen))

  const visto = new Uint8Array(mapa.ancho * mapa.alto)
  const cabezas: Cabeza[] = []
  // Una cabeza mide más o menos un espacio de alto y algo más de ancho.
  const anchoEsperado = renglon.separacion * 1.3
  const altoEsperado = renglon.separacion

  // Lo que hay antes de la primera barra de compás es la clave y el compás,
  // no música. Si no se salta, el 4/4 y el número del ejercicio entran como
  // si fueran notas.
  const arranque = Math.max(renglon.x0, Math.round(desdeX))

  for (let y = y0; y <= y1; y++) {
    for (let x = arranque; x <= renglon.x1; x++) {
      const i = y * mapa.ancho + x
      if (!limpio.tinta[i] || visto[i]) continue

      const mancha = inundar(limpio, visto, x, y, y0, y1)
      const ancho = mancha.x1 - mancha.x0 + 1
      const alto = mancha.y1 - mancha.y0 + 1

      // Ni polvo ni barras: solo cosas del tamaño de una cabeza de nota.
      if (ancho < anchoEsperado * 0.45 || ancho > anchoEsperado * 2.2) continue
      if (alto < altoEsperado * 0.45 || alto > altoEsperado * 2.4) continue

      const centroY = (mancha.y0 + mancha.y1) / 2
      cabezas.push({
        x: (mancha.x0 + mancha.x1) / 2,
        y: centroY,
        ancho,
        alto,
        relleno: mancha.pixeles / (ancho * alto),
        posicion: (centroY - renglon.lineas[0]) / (renglon.separacion / 2),
      })
    }
  }

  return juntarTrozos(cabezas.sort((a, b) => a.x - b.x), renglon.separacion)
}

/**
 * Une los trozos de una misma cabeza.
 *
 * Una x de platillo son dos trazos cruzados, y al quitar plicas y barras se
 * puede partir en pedazos que, sueltos, tienen tamaño de cabeza. Sin juntarlos
 * cada platillo se contaba dos veces. Se consideran el mismo golpe los trozos
 * que caen casi en el mismo sitio.
 */
function juntarTrozos(cabezas: Cabeza[], separacion: number): Cabeza[] {
  const juntas: Cabeza[] = []
  for (const cabeza of cabezas) {
    const anterior = juntas[juntas.length - 1]
    const mismoSitio =
      anterior &&
      Math.abs(cabeza.x - anterior.x) < separacion * 0.9 &&
      Math.abs(cabeza.y - anterior.y) < separacion * 0.9

    if (!mismoSitio) {
      juntas.push(cabeza)
      continue
    }

    // Se quedan con el recuadro que abarca a los dos.
    const x0 = Math.min(anterior.x - anterior.ancho / 2, cabeza.x - cabeza.ancho / 2)
    const x1 = Math.max(anterior.x + anterior.ancho / 2, cabeza.x + cabeza.ancho / 2)
    const y0 = Math.min(anterior.y - anterior.alto / 2, cabeza.y - cabeza.alto / 2)
    const y1 = Math.max(anterior.y + anterior.alto / 2, cabeza.y + cabeza.alto / 2)
    juntas[juntas.length - 1] = {
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      ancho: x1 - x0,
      alto: y1 - y0,
      relleno: (anterior.relleno + cabeza.relleno) / 2,
      posicion: (anterior.posicion + cabeza.posicion) / 2,
    }
  }
  return juntas
}

/**
 * Borra las líneas del pentagrama: en las filas donde está la línea, se quita
 * la tinta cuyo recorrido vertical es tan fino como la propia línea. Lo que
 * cruza la línea (una cabeza, una plica) es más alto y se queda.
 */
function quitarLineas(mapa: Mapa, renglon: Renglon): Mapa {
  const tinta = new Uint8Array(mapa.tinta)
  const grosor = Math.max(1, Math.round(renglon.separacion * 0.22))

  for (const linea of renglon.lineas) {
    const centro = Math.round(linea)
    for (let y = centro - grosor; y <= centro + grosor; y++) {
      if (y < 0 || y >= mapa.alto) continue
      for (let x = 0; x < mapa.ancho; x++) {
        const i = y * mapa.ancho + x
        if (!tinta[i]) continue
        // ¿Hasta dónde llega la tinta hacia arriba y hacia abajo?
        let alto = 1
        for (let k = y - 1; k >= 0 && mapa.tinta[k * mapa.ancho + x]; k--) alto++
        for (let k = y + 1; k < mapa.alto && mapa.tinta[k * mapa.ancho + x]; k++) alto++
        if (alto <= grosor * 2 + 1) tinta[i] = 0
      }
    }
  }
  return { ...mapa, tinta }
}

/**
 * Borra plicas y barras de unión.
 *
 * Esto es lo que hace que el método funcione. Sin ello, cuatro semicorcheas
 * unidas por su barra son UNA sola mancha de tinta —las plicas las cosen por
 * arriba— del ancho de un tiempo entero, y el filtro por tamaño la tira a la
 * basura: se perdían casi todas las notas de la página.
 *
 * La regla es de tamaños: una plica es un trazo vertical mucho más alto que
 * una cabeza, y una barra de unión un trazo horizontal mucho más largo. La
 * cabeza no es ni lo uno ni lo otro, así que sobrevive.
 */
function quitarPalos(mapa: Mapa, renglon: Renglon): Mapa {
  const { ancho, alto } = mapa
  const tinta = new Uint8Array(mapa.tinta)
  const altoMaximo = renglon.separacion * 1.7
  const largoMaximo = renglon.separacion * 2.1

  // Trazos verticales largos: plicas y barras de compás.
  for (let x = 0; x < ancho; x++) {
    let desde = -1
    for (let y = 0; y <= alto; y++) {
      const hay = y < alto && mapa.tinta[y * ancho + x] === 1
      if (hay && desde === -1) desde = y
      if (!hay && desde !== -1) {
        if (y - desde > altoMaximo) {
          for (let k = desde; k < y; k++) tinta[k * ancho + x] = 0
        }
        desde = -1
      }
    }
  }

  // Trazos horizontales largos: barras de unión y lo que quede de las líneas.
  for (let y = 0; y < alto; y++) {
    const base = y * ancho
    let desde = -1
    for (let x = 0; x <= ancho; x++) {
      const hay = x < ancho && mapa.tinta[base + x] === 1
      if (hay && desde === -1) desde = x
      if (!hay && desde !== -1) {
        if (x - desde > largoMaximo) {
          for (let k = desde; k < x; k++) tinta[base + k] = 0
        }
        desde = -1
      }
    }
  }

  return { ...mapa, tinta }
}

/** Mancha conectada, recorrida sin recursión para no reventar la pila. */
function inundar(
  mapa: Mapa,
  visto: Uint8Array,
  x0: number,
  y0: number,
  limiteArriba: number,
  limiteAbajo: number,
): { x0: number; x1: number; y0: number; y1: number; pixeles: number } {
  const pila = [y0 * mapa.ancho + x0]
  visto[pila[0]] = 1
  let minX = x0
  let maxX = x0
  let minY = y0
  let maxY = y0
  let pixeles = 0

  while (pila.length > 0) {
    const i = pila.pop()!
    const x = i % mapa.ancho
    const y = (i - x) / mapa.ancho
    pixeles++
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= mapa.ancho || ny < limiteArriba || ny > limiteAbajo) continue
      const j = ny * mapa.ancho + nx
      if (mapa.tinta[j] && !visto[j]) {
        visto[j] = 1
        pila.push(j)
      }
    }
  }

  return { x0: minX, x1: maxX, y0: minY, y1: maxY, pixeles }
}
