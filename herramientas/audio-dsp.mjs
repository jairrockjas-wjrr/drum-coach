// Procesado de audio para preparar los samples de la batería.
// Es lo que haría un ingeniero al mezclar un disco: ecualizar cada pieza,
// comprimirla para que tenga pegada y saturarla un poco para darle carácter.
// Todo se hace una sola vez, aquí, y la app solo reproduce el resultado.

const SR = 44100

/**
 * Filtro biquad (fórmulas clásicas de Robert Bristow-Johnson).
 * tipo: 'pico' | 'graves' | 'agudos' | 'pasaaltos' | 'pasabajos'
 */
export function filtrar(muestras, { tipo, frecuencia, q = 0.707, db = 0 }) {
  const A = Math.pow(10, db / 40)
  const w0 = (2 * Math.PI * frecuencia) / SR
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * q)
  let b0, b1, b2, a0, a1, a2

  switch (tipo) {
    case 'pico':
      b0 = 1 + alpha * A
      b1 = -2 * cos
      b2 = 1 - alpha * A
      a0 = 1 + alpha / A
      a1 = -2 * cos
      a2 = 1 - alpha / A
      break
    case 'graves': {
      const raiz = 2 * Math.sqrt(A) * (sin / 2) * Math.sqrt(2)
      b0 = A * (A + 1 - (A - 1) * cos + raiz)
      b1 = 2 * A * (A - 1 - (A + 1) * cos)
      b2 = A * (A + 1 - (A - 1) * cos - raiz)
      a0 = A + 1 + (A - 1) * cos + raiz
      a1 = -2 * (A - 1 + (A + 1) * cos)
      a2 = A + 1 + (A - 1) * cos - raiz
      break
    }
    case 'agudos': {
      const raiz = 2 * Math.sqrt(A) * (sin / 2) * Math.sqrt(2)
      b0 = A * (A + 1 + (A - 1) * cos + raiz)
      b1 = -2 * A * (A - 1 + (A + 1) * cos)
      b2 = A * (A + 1 + (A - 1) * cos - raiz)
      a0 = A + 1 - (A - 1) * cos + raiz
      a1 = 2 * (A - 1 - (A + 1) * cos)
      a2 = A + 1 - (A - 1) * cos - raiz
      break
    }
    case 'pasaaltos':
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = (1 + cos) / 2
      a0 = 1 + alpha
      a1 = -2 * cos
      a2 = 1 - alpha
      break
    case 'pasabajos':
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
      a0 = 1 + alpha
      a1 = -2 * cos
      a2 = 1 - alpha
      break
    default:
      throw new Error('Filtro desconocido: ' + tipo)
  }

  const salida = new Float32Array(muestras.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < muestras.length; i++) {
    const x0 = muestras[i]
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2
    salida[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
  return salida
}

/**
 * Compresor: baja los picos y sube lo demás, que es lo que hace que un golpe
 * suene "de disco" en vez de crudo.
 */
export function comprimir(muestras, { umbralDb, ratio, ataqueMs, soltarMs, compensarDb = 0 }) {
  const coefAtaque = Math.exp(-1 / ((ataqueMs / 1000) * SR))
  const coefSoltar = Math.exp(-1 / ((soltarMs / 1000) * SR))
  const compensar = Math.pow(10, compensarDb / 20)
  const salida = new Float32Array(muestras.length)
  let envolvente = 0

  for (let i = 0; i < muestras.length; i++) {
    const nivel = Math.abs(muestras[i])
    const coef = nivel > envolvente ? coefAtaque : coefSoltar
    envolvente = coef * envolvente + (1 - coef) * nivel

    const db = 20 * Math.log10(envolvente + 1e-9)
    const exceso = db - umbralDb
    const reduccionDb = exceso > 0 ? -exceso * (1 - 1 / ratio) : 0
    salida[i] = muestras[i] * Math.pow(10, reduccionDb / 20) * compensar
  }
  return salida
}

/** Saturación suave: redondea los picos y da cuerpo, como una cinta. */
export function saturar(muestras, cantidad) {
  if (cantidad <= 0) return muestras
  const k = 1 + cantidad * 4
  const normal = Math.tanh(k)
  const salida = new Float32Array(muestras.length)
  for (let i = 0; i < muestras.length; i++) salida[i] = Math.tanh(muestras[i] * k) / normal
  return salida
}

/** Deja el pico exactamente en el nivel pedido. */
export function nivelar(muestras, nivel) {
  let pico = 1e-6
  for (const v of muestras) pico = Math.max(pico, Math.abs(v))
  const factor = nivel / pico
  const salida = new Float32Array(muestras.length)
  for (let i = 0; i < muestras.length; i++) salida[i] = muestras[i] * factor
  return salida
}

/** Apaga el final para que el corte no haga "clic". */
export function fundirFinal(muestras, segundos = 0.05) {
  const largo = Math.min(muestras.length, Math.round(segundos * SR))
  for (let i = 0; i < largo; i++) {
    muestras[muestras.length - 1 - i] *= i / largo
  }
  return muestras
}

/** Aplica una cadena de ecualización. */
export function ecualizar(muestras, bandas) {
  let señal = muestras
  for (const banda of bandas) señal = filtrar(señal, banda)
  return señal
}

/**
 * Baja (o sube) la afinación del tambor. factor < 1 lo hace más grave y más
 * largo, que es lo que convierte un tambor chico de jazz en uno más gordo.
 */
export function afinar(muestras, factor) {
  if (factor === 1) return muestras
  const largo = Math.round(muestras.length / factor)
  const salida = new Float32Array(largo)
  for (let i = 0; i < largo; i++) {
    const posicion = i * factor
    const j = Math.floor(posicion)
    const resto = posicion - j
    const a = muestras[j] ?? 0
    const b = muestras[j + 1] ?? 0
    salida[i] = a * (1 - resto) + b * resto
  }
  return salida
}

/**
 * Apaga la resonancia del tambor: mantiene el golpe y luego lo corta.
 * Es lo mismo que ponerle un trapo o una puerta de ruido en el estudio,
 * y es lo que hace que el golpe suene seco en vez de zumbar.
 */
export function acortar(muestras, { mantenerMs, caidaMs }) {
  const mantener = Math.round((mantenerMs / 1000) * SR)
  const caida = Math.round((caidaMs / 1000) * SR)
  const total = Math.min(muestras.length, mantener + caida)
  const salida = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    let ganancia = 1
    if (i > mantener) {
      const avance = (i - mantener) / caida
      ganancia = (1 - avance) * (1 - avance) // caída rápida, sin cola
    }
    salida[i] = muestras[i] * ganancia
  }
  return salida
}
