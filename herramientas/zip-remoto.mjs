// Lee un archivo ZIP que está en un servidor sin descargarlo entero.
// Usa peticiones por rango (Range) para traer solo el índice del ZIP y,
// después, únicamente los archivos que nos interesan.
// Así sacamos unos pocos samples de un paquete de 1,2 GB.

import { inflateRawSync } from 'node:zlib'

async function traerRango(url, desde, hasta) {
  const respuesta = await fetch(url, { headers: { Range: `bytes=${desde}-${hasta}` } })
  if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`)
  return Buffer.from(await respuesta.arrayBuffer())
}

/** Lee el índice (directorio central) del ZIP remoto. */
export async function leerIndice(url) {
  const cabeza = await fetch(url, { method: 'HEAD' })
  const total = Number(cabeza.headers.get('content-length'))
  if (!cabeza.headers.get('accept-ranges')?.includes('bytes')) {
    throw new Error('El servidor no admite descargas por partes')
  }

  // El "fin del directorio central" está al final del archivo.
  const cola = await traerRango(url, Math.max(0, total - 65557), total - 1)
  let fin = -1
  for (let i = cola.length - 22; i >= 0; i--) {
    if (cola.readUInt32LE(i) === 0x06054b50) {
      fin = i
      break
    }
  }
  if (fin === -1) throw new Error('No se encontró el índice del ZIP')

  const entradas = cola.readUInt16LE(fin + 10)
  const tamanoIndice = cola.readUInt32LE(fin + 12)
  const inicioIndice = cola.readUInt32LE(fin + 16)

  const indice = await traerRango(url, inicioIndice, inicioIndice + tamanoIndice - 1)

  const archivos = []
  let p = 0
  for (let i = 0; i < entradas; i++) {
    if (indice.readUInt32LE(p) !== 0x02014b50) break
    const metodo = indice.readUInt16LE(p + 10)
    const comprimido = indice.readUInt32LE(p + 20)
    const original = indice.readUInt32LE(p + 24)
    const largoNombre = indice.readUInt16LE(p + 28)
    const largoExtra = indice.readUInt16LE(p + 30)
    const largoComentario = indice.readUInt16LE(p + 32)
    const desplazamiento = indice.readUInt32LE(p + 42)
    const nombre = indice.toString('utf8', p + 46, p + 46 + largoNombre)
    archivos.push({ nombre, metodo, comprimido, original, desplazamiento })
    p += 46 + largoNombre + largoExtra + largoComentario
  }
  return { total, archivos }
}

/** Descarga y descomprime un archivo concreto del ZIP remoto. */
export async function traerArchivo(url, entrada) {
  // La cabecera local dice cuánto ocupan el nombre y los extras antes de los datos.
  const cabecera = await traerRango(url, entrada.desplazamiento, entrada.desplazamiento + 29)
  const largoNombre = cabecera.readUInt16LE(26)
  const largoExtra = cabecera.readUInt16LE(28)
  const inicioDatos = entrada.desplazamiento + 30 + largoNombre + largoExtra
  const datos = await traerRango(url, inicioDatos, inicioDatos + entrada.comprimido - 1)
  return entrada.metodo === 0 ? datos : inflateRawSync(datos)
}
