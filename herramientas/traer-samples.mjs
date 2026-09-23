// Saca los samples de la batería del pack "Virtuosity Drums" de Versilian
// Studios (licencia CC0 1.0, dominio público) y los deja listos para la app.
//
// El pack pesa 1,2 GB, así que NO se descarga entero: se lee el índice del ZIP
// por rangos y solo se bajan los trece archivos que usamos (unos 3 MB).
// Después cada uno se pasa a mono, se recorta, se normaliza y se guarda en AAC,
// que es lo que reproduce Safari en el iPhone.
//
// Se ejecuta con: npm run samples

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { leerIndice, traerArchivo } from './zip-remoto.mjs'

const PACK = 'https://versilian-studios.com/Distro/Virtuosity_Drums_v0.925.zip'
const MICRO = 'mid' // la toma de micrófono más equilibrada del pack
const DESTINO = new URL('../public/sonidos/', import.meta.url)
const TEMPORAL = new URL('../.samples-tmp/', import.meta.url)

/**
 * Qué sample usamos para cada pieza.
 *  carpeta/articulacion: dónde buscarlo dentro del pack.
 *  fuerza: 0–1, qué capa de volumen elegir (1 = el golpe más fuerte grabado).
 *  segundos: cuánto conservamos del golpe.
 */
const PIEZAS = {
  bombo: { carpeta: 'kick', articulacion: 'snon', fuerza: 1, segundos: 1.0 },
  tarola: { carpeta: 'snare', articulacion: 'center', fuerza: 0.8, segundos: 1.0 },
  tarolaAro: { carpeta: 'snare', articulacion: 'rimshot', fuerza: 0.85, segundos: 1.1 },
  aro: { carpeta: 'snare', articulacion: 'crossstick', fuerza: 0.8, segundos: 0.7 },
  hiHatCerrado: { carpeta: 'hh', articulacion: 'closed', fuerza: 0.85, segundos: 0.5 },
  hiHatAbierto: { carpeta: 'hh', articulacion: 'open', fuerza: 0.85, segundos: 1.4 },
  hiHatPedal: { carpeta: 'hh', articulacion: 'pedal', fuerza: 0.85, segundos: 0.5 },
  ride: { carpeta: 'ride', articulacion: 'ride', fuerza: 0.7, segundos: 1.8 },
  campana: { carpeta: 'ride', articulacion: 'bell', fuerza: 0.8, segundos: 1.5 },
  crash: { carpeta: 'crash', articulacion: 'crash', fuerza: 0.8, segundos: 2.6 },
  tomAgudo: { carpeta: 'htom', articulacion: 'center', fuerza: 0.8, segundos: 1.3 },
  tomMedio: { carpeta: 'ltom', articulacion: 'center', fuerza: 0.8, segundos: 1.5 },
  // El pack solo trae dos toms; el de piso se consigue bajándole la afinación
  // al tom grave al reproducirlo (ver src/audio/bateria.ts).
}

/** Elige el archivo que mejor encaja con la fuerza pedida. */
function elegir(archivos, carpeta, articulacion, fuerza) {
  const prefijo = `Samples/${MICRO}/${carpeta}/${MICRO}_${carpeta}_${articulacion}_`
  const candidatos = archivos
    .filter((a) => a.nombre.startsWith(prefijo) && a.nombre.endsWith('.flac'))
    .map((a) => ({ ...a, vl: Number((a.nombre.match(/_vl(\d+)/) || [])[1] ?? 0) }))
  if (candidatos.length === 0) throw new Error(`No hay samples de ${carpeta}/${articulacion}`)

  const maximo = Math.max(...candidatos.map((c) => c.vl))
  const objetivo = Math.max(1, Math.round(maximo * fuerza))
  // El más cercano al objetivo; a igualdad, la primera repetición (rr1).
  return candidatos.sort(
    (a, b) => Math.abs(a.vl - objetivo) - Math.abs(b.vl - objetivo) || a.nombre.localeCompare(b.nombre),
  )[0]
}

/** Recorta el silencio del principio, limita la duración, normaliza y hace un fundido. */
function prepararWav(ruta, segundos) {
  const datos = readFileSync(ruta)

  // Localizamos el trozo "data" del WAV (no siempre está en la misma posición).
  let p = 12
  let inicioDatos = -1
  let largoDatos = 0
  while (p + 8 <= datos.length) {
    const tipo = datos.toString('ascii', p, p + 4)
    const largo = datos.readUInt32LE(p + 4)
    if (tipo === 'data') {
      inicioDatos = p + 8
      largoDatos = largo
      break
    }
    p += 8 + largo + (largo % 2)
  }
  if (inicioDatos === -1) throw new Error('WAV sin datos')

  const total = Math.min(largoDatos, datos.length - inicioDatos) / 2
  const muestras = new Int16Array(total)
  for (let i = 0; i < total; i++) muestras[i] = datos.readInt16LE(inicioDatos + i * 2)

  // Quitamos el silencio inicial para que el golpe empiece justo en el tiempo.
  const UMBRAL = 250
  let desde = 0
  while (desde < muestras.length && Math.abs(muestras[desde]) < UMBRAL) desde++
  desde = Math.max(0, desde - 20) // unas pocas muestras de aire antes del golpe

  const maximoMuestras = Math.round(44100 * segundos)
  const largo = Math.min(muestras.length - desde, maximoMuestras)
  const recorte = muestras.subarray(desde, desde + largo)

  // Normalizamos al 97 % para que todas las piezas tengan el mismo nivel de salida.
  let pico = 1
  for (const v of recorte) pico = Math.max(pico, Math.abs(v))
  const factor = (32767 * 0.97) / pico

  const fundido = Math.min(2200, Math.round(largo * 0.25)) // evita el "clic" del corte
  const salida = Buffer.alloc(44 + largo * 2)
  salida.write('RIFF', 0, 'ascii')
  salida.writeUInt32LE(36 + largo * 2, 4)
  salida.write('WAVEfmt ', 8, 'ascii')
  salida.writeUInt32LE(16, 16)
  salida.writeUInt16LE(1, 20)
  salida.writeUInt16LE(1, 22)
  salida.writeUInt32LE(44100, 24)
  salida.writeUInt32LE(44100 * 2, 28)
  salida.writeUInt16LE(2, 32)
  salida.writeUInt16LE(16, 34)
  salida.write('data', 36, 'ascii')
  salida.writeUInt32LE(largo * 2, 40)

  for (let i = 0; i < largo; i++) {
    let v = recorte[i] * factor
    const restan = largo - i
    if (restan < fundido) v *= restan / fundido
    salida.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), 44 + i * 2)
  }
  writeFileSync(ruta, salida)
  return largo / 44100
}

// --- Proceso ---
mkdirSync(DESTINO, { recursive: true })
mkdirSync(TEMPORAL, { recursive: true })

console.log('Leyendo el índice del pack (sin descargarlo entero)…')
const { total, archivos } = await leerIndice(PACK)
console.log(`Pack de ${(total / 1e6).toFixed(0)} MB; bajamos solo lo necesario.\n`)

let bajado = 0
const resumen = []

for (const [pieza, ajustes] of Object.entries(PIEZAS)) {
  const entrada = elegir(archivos, ajustes.carpeta, ajustes.articulacion, ajustes.fuerza)
  const datos = await traerArchivo(PACK, entrada)
  bajado += entrada.comprimido

  const flac = new URL(`${pieza}.flac`, TEMPORAL)
  const wav = new URL(`${pieza}.wav`, TEMPORAL)
  const m4a = new URL(`${pieza}.m4a`, DESTINO)
  writeFileSync(flac, datos)

  // A mono y 44,1 kHz, que es lo que necesita la app.
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', flac.pathname, wav.pathname])
  const duracion = prepararWav(wav.pathname, ajustes.segundos)
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wav.pathname, m4a.pathname])

  const tamano = readFileSync(m4a).length
  resumen.push({ pieza, origen: entrada.nombre.split('/').pop(), duracion, tamano })
  console.log(
    `  ${pieza.padEnd(14)} ${entrada.nombre.split('/').pop().padEnd(34)} ${duracion.toFixed(2)} s  ${(tamano / 1024).toFixed(0)} KB`,
  )
}

rmSync(TEMPORAL, { recursive: true, force: true })

// Dejamos por escrito de dónde salió cada sonido y con qué licencia.
const creditos = `# Sonidos de la batería

Los samples de la batería salen de **Virtuosity Drums** de Versilian Studios,
publicado bajo **Creative Commons Zero 1.0 Universal (CC0 1.0)**, es decir,
dominio público: se puede usar para cualquier fin, sin pedir permiso ni dar
crédito. Aun así lo dejamos escrito aquí.

- Pack: Virtuosity Drums v0.925
- Autor: Versilian Studios LLC
- Licencia: CC0 1.0 Universal (el texto completo viene dentro del propio pack)
- Origen: https://versilian-studios.com/virtuosity-drums/

Toma de micrófono usada: \`${MICRO}\`. Cada archivo se pasó a mono 44,1 kHz, se
recortó el silencio inicial, se normalizó y se guardó en AAC (.m4a), que es el
formato que reproduce Safari en el iPhone.

Para regenerarlos: \`npm run samples\`.

| Pieza | Archivo original | Duración | Tamaño |
|---|---|---|---|
${resumen.map((r) => `| ${r.pieza} | \`${r.origen}\` | ${r.duracion.toFixed(2)} s | ${(r.tamano / 1024).toFixed(0)} KB |`).join('\n')}

El tom de piso no tiene sample propio: el pack solo trae dos toms, así que se
reproduce el tom grave con la afinación bajada.
`
writeFileSync(new URL('CREDITOS.md', DESTINO), creditos)

const totalKb = resumen.reduce((t, r) => t + r.tamano, 0) / 1024
console.log(`\nBajados ${(bajado / 1e6).toFixed(1)} MB del pack.`)
console.log(`Sonidos listos en public/sonidos/: ${totalKb.toFixed(0)} KB en total.`)
