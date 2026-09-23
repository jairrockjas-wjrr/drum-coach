// Saca los samples de la batería del pack "Virtuosity Drums" de Versilian
// Studios (licencia CC0 1.0, dominio público) y los deja listos para la app.
//
// El pack pesa 1,2 GB, así que NO se descarga entero: se lee el índice del ZIP
// por rangos y solo se bajan los archivos que usamos.
//
// Cada golpe está grabado a la vez con varios micrófonos (cercano al bombo,
// cercano a la tarola, aéreos y sala). Aquí se mezclan como en un estudio:
// el micrófono cercano da el golpe y la definición, y los aéreos dan el aire
// y los platillos. Además cada pieza se deja a su volumen natural dentro del
// kit: el hi-hat no puede sonar tan fuerte como el bombo.
//
// Se ejecuta con: npm run samples

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { leerIndice, traerArchivo } from './zip-remoto.mjs'
import { acortar, afinar, comprimir, ecualizar, fundirFinal, nivelar, saturar } from './audio-dsp.mjs'

const PACK = 'https://versilian-studios.com/Distro/Virtuosity_Drums_v0.925.zip'
const DESTINO = new URL('../public/sonidos/', import.meta.url)
const TEMPORAL = new URL('../.samples-tmp/', import.meta.url)

/**
 * Receta de cada pieza.
 *
 * El pack es un kit de jazz: tambores chicos, afinados agudos y con mucha
 * resonancia. Aquí se convierte en un kit de estudio más gordo y seco:
 *
 *  capas: micrófonos que se mezclan. El primero manda: marca dónde empieza el
 *         golpe y da la definición. "room" es la sala.
 *  fuerza: qué capa de volumen del pack se usa (1 = el golpe más fuerte).
 *  afinacion: por debajo de 1 baja el tono y engorda el tambor.
 *  eq: filtros en orden.
 *  compresor: pegada y sostenido.
 *  puerta: apaga la resonancia (mantiene el golpe y corta la cola).
 *  saturacion: 0–1, cuerpo y carácter.
 *  nivel: volumen final dentro del kit.
 *  segundos: cuánto se recorta del original antes de procesar.
 */
const PIEZAS = {
  bombo: {
    carpeta: 'kick',
    articulacion: 'snon',
    capas: [['kickmic', 1], ['mid', 0.3]],
    fuerza: 1,
    afinacion: 0.86, // un bombo más grande
    eq: [
      { tipo: 'pasaaltos', frecuencia: 25 },
      { tipo: 'graves', frecuencia: 58, db: 8 }, // el "gordo"
      { tipo: 'pico', frecuencia: 400, q: 1.1, db: -7 }, // fuera el cartón
      { tipo: 'pico', frecuencia: 2600, q: 1.4, db: 2 }, // lo justo para oírlo
      { tipo: 'agudos', frecuencia: 6000, db: -5 }, // menos agudo
    ],
    compresor: { umbralDb: -16, ratio: 4, ataqueMs: 12, soltarMs: 120, compensarDb: 3 },
    puerta: { mantenerMs: 85, caidaMs: 270 },
    saturacion: 0.2,
    nivel: 1,
    segundos: 0.9,
  },
  tarola: {
    carpeta: 'snare',
    articulacion: 'center',
    capas: [['snaremic', 1], ['oh', 0.3], ['room', 0.12]],
    fuerza: 0.85,
    afinacion: 0.93,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 80 },
      { tipo: 'pico', frecuencia: 185, q: 1, db: 4 }, // cuerpo
      { tipo: 'pico', frecuencia: 850, q: 1.2, db: -4 },
      { tipo: 'agudos', frecuencia: 6000, db: 1 }, // apenas un toque de crack
    ],
    compresor: { umbralDb: -18, ratio: 4, ataqueMs: 4, soltarMs: 120, compensarDb: 3 },
    puerta: { mantenerMs: 65, caidaMs: 290 },
    saturacion: 0.22,
    nivel: 0.92,
    segundos: 0.9,
  },
  tarolaAro: {
    carpeta: 'snare',
    articulacion: 'rimshot',
    capas: [['snaremic', 1], ['oh', 0.3], ['room', 0.14]],
    fuerza: 0.9,
    afinacion: 0.93,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 90 },
      { tipo: 'pico', frecuencia: 210, q: 1, db: 3 },
      { tipo: 'pico', frecuencia: 3200, q: 1.3, db: 2 },
      { tipo: 'agudos', frecuencia: 7000, db: -2 },
    ],
    compresor: { umbralDb: -18, ratio: 5, ataqueMs: 2, soltarMs: 130, compensarDb: 3 },
    puerta: { mantenerMs: 70, caidaMs: 310 },
    saturacion: 0.25,
    nivel: 1,
    segundos: 0.9,
  },
  aro: {
    carpeta: 'snare',
    articulacion: 'crossstick',
    capas: [['snaremic', 1], ['oh', 0.2]],
    fuerza: 0.8,
    afinacion: 0.95,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 150 },
      { tipo: 'pico', frecuencia: 900, q: 1.2, db: 4 }, // la madera
      { tipo: 'agudos', frecuencia: 6500, db: -3 },
    ],
    compresor: { umbralDb: -20, ratio: 3, ataqueMs: 3, soltarMs: 90, compensarDb: 2 },
    puerta: { mantenerMs: 25, caidaMs: 110 },
    saturacion: 0.15,
    nivel: 0.52,
    segundos: 0.6,
  },
  hiHatCerrado: {
    carpeta: 'hh',
    articulacion: 'closed',
    capas: [['oh', 1], ['snaremic', 0.3]],
    fuerza: 0.8,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 260 },
      { tipo: 'pico', frecuencia: 1200, q: 1, db: -2 },
      { tipo: 'agudos', frecuencia: 9000, db: -1 }, // sin estridencia
    ],
    compresor: { umbralDb: -22, ratio: 2.5, ataqueMs: 2, soltarMs: 80, compensarDb: 1.5 },
    puerta: { mantenerMs: 30, caidaMs: 150 },
    saturacion: 0.1,
    nivel: 0.4,
    segundos: 0.45,
  },
  hiHatAbierto: {
    carpeta: 'hh',
    articulacion: 'open',
    capas: [['oh', 1], ['snaremic', 0.25], ['room', 0.1]],
    fuerza: 0.8,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 250 },
      { tipo: 'agudos', frecuencia: 8500, db: 0 },
    ],
    compresor: { umbralDb: -24, ratio: 2.5, ataqueMs: 3, soltarMs: 180, compensarDb: 1.5 },
    puerta: { mantenerMs: 260, caidaMs: 600 },
    saturacion: 0.1,
    nivel: 0.5,
    segundos: 1.2,
  },
  hiHatPedal: {
    carpeta: 'hh',
    articulacion: 'pedal',
    capas: [['oh', 1], ['snaremic', 0.3]],
    fuerza: 0.8,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 220 },
      { tipo: 'agudos', frecuencia: 7000, db: -2 },
    ],
    compresor: { umbralDb: -22, ratio: 3, ataqueMs: 2, soltarMs: 70, compensarDb: 1.5 },
    puerta: { mantenerMs: 25, caidaMs: 130 },
    saturacion: 0.1,
    nivel: 0.3,
    segundos: 0.45,
  },
  ride: {
    carpeta: 'ride',
    articulacion: 'ride',
    capas: [['oh', 1], ['mid', 0.3], ['room', 0.1]],
    fuerza: 0.7,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 200 },
      { tipo: 'pico', frecuencia: 2800, q: 1.2, db: 2 }, // el "ping"
      { tipo: 'agudos', frecuencia: 9500, db: 0 },
    ],
    compresor: { umbralDb: -24, ratio: 2.5, ataqueMs: 3, soltarMs: 220, compensarDb: 2 },
    // Los platillos sí resuenan: solo se les recorta el final.
    puerta: { mantenerMs: 900, caidaMs: 700 },
    saturacion: 0.12,
    nivel: 0.48,
    segundos: 1.8,
  },
  campana: {
    carpeta: 'ride',
    articulacion: 'bell',
    capas: [['oh', 1], ['mid', 0.3], ['room', 0.1]],
    fuerza: 0.8,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 220 },
      { tipo: 'pico', frecuencia: 2200, q: 1.5, db: 3 },
      { tipo: 'agudos', frecuencia: 8000, db: -1 },
    ],
    compresor: { umbralDb: -24, ratio: 3, ataqueMs: 3, soltarMs: 200, compensarDb: 2 },
    puerta: { mantenerMs: 700, caidaMs: 600 },
    saturacion: 0.12,
    nivel: 0.56,
    segundos: 1.5,
  },
  crash: {
    carpeta: 'crash',
    articulacion: 'crash',
    capas: [['oh', 1], ['mid', 0.35], ['room', 0.2]],
    fuerza: 0.85,
    afinacion: 1,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 150 },
      { tipo: 'pico', frecuencia: 800, q: 1, db: -2 },
      { tipo: 'agudos', frecuencia: 8000, db: 0 },
    ],
    compresor: { umbralDb: -26, ratio: 2, ataqueMs: 5, soltarMs: 400, compensarDb: 2 },
    puerta: { mantenerMs: 1400, caidaMs: 900 },
    saturacion: 0.1,
    nivel: 0.78,
    segundos: 2.4,
  },
  tomAgudo: {
    carpeta: 'htom',
    articulacion: 'center',
    capas: [['mid', 1], ['oh', 0.4], ['room', 0.16]],
    fuerza: 0.85,
    afinacion: 0.86, // tom más grande
    eq: [
      { tipo: 'pasaaltos', frecuencia: 50 },
      { tipo: 'graves', frecuencia: 100, db: 5 },
      { tipo: 'pico', frecuencia: 420, q: 1.3, db: -8 }, // el cartón, fuera
      { tipo: 'pico', frecuencia: 3200, q: 1.3, db: 2 }, // la baqueta, sin pasarse
      { tipo: 'agudos', frecuencia: 6500, db: -4 },
    ],
    compresor: { umbralDb: -20, ratio: 4, ataqueMs: 8, soltarMs: 200, compensarDb: 4 },
    puerta: { mantenerMs: 105, caidaMs: 400 },
    saturacion: 0.2,
    nivel: 0.85,
    segundos: 1.3,
  },
  tomMedio: {
    carpeta: 'ltom',
    articulacion: 'center',
    capas: [['mid', 1], ['oh', 0.4], ['room', 0.16]],
    fuerza: 0.85,
    afinacion: 0.85,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 45 },
      { tipo: 'graves', frecuencia: 85, db: 5 },
      { tipo: 'pico', frecuencia: 380, q: 1.3, db: -8 },
      { tipo: 'pico', frecuencia: 2800, q: 1.3, db: 2 },
      { tipo: 'agudos', frecuencia: 6000, db: -4 },
    ],
    compresor: { umbralDb: -20, ratio: 4, ataqueMs: 8, soltarMs: 240, compensarDb: 4 },
    puerta: { mantenerMs: 125, caidaMs: 500 },
    saturacion: 0.2,
    nivel: 0.88,
    segundos: 1.5,
  },
}

/** Elige el archivo que mejor encaja con la fuerza pedida, en un micrófono. */
function elegir(archivos, micro, carpeta, articulacion, fuerza) {
  const prefijo = `Samples/${micro}/${carpeta}/${micro}_${carpeta}_${articulacion}_`
  const candidatos = archivos
    .filter((a) => a.nombre.startsWith(prefijo) && a.nombre.endsWith('.flac'))
    .map((a) => ({ ...a, vl: Number((a.nombre.match(/_vl(\d+)/) || [])[1] ?? 0) }))
  if (candidatos.length === 0) throw new Error(`No hay samples de ${micro}/${carpeta}/${articulacion}`)
  const maximo = Math.max(...candidatos.map((c) => c.vl))
  const objetivo = Math.max(1, Math.round(maximo * fuerza))
  return candidatos.sort(
    (a, b) => Math.abs(a.vl - objetivo) - Math.abs(b.vl - objetivo) || a.nombre.localeCompare(b.nombre),
  )[0]
}

/** Lee el audio de un WAV de 16 bits y lo devuelve como muestras. */
function leerWav(ruta) {
  const datos = readFileSync(ruta)
  let p = 12
  while (p + 8 <= datos.length) {
    const tipo = datos.toString('ascii', p, p + 4)
    const largo = datos.readUInt32LE(p + 4)
    if (tipo === 'data') {
      const total = Math.min(largo, datos.length - p - 8) / 2
      const muestras = new Float32Array(total)
      for (let i = 0; i < total; i++) muestras[i] = datos.readInt16LE(p + 8 + i * 2) / 32768
      return muestras
    }
    p += 8 + largo + (largo % 2)
  }
  throw new Error('WAV sin datos')
}

/** Escribe muestras como WAV mono de 16 bits. */
function escribirWav(ruta, muestras) {
  const largo = muestras.length
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
    const v = Math.max(-1, Math.min(1, muestras[i]))
    salida.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(ruta, salida)
}

// --- Proceso ---
mkdirSync(DESTINO, { recursive: true })
mkdirSync(TEMPORAL, { recursive: true })

console.log('Leyendo el índice del pack (sin descargarlo entero)…')
const { total, archivos } = await leerIndice(PACK)
console.log(`Pack de ${(total / 1e6).toFixed(0)} MB; bajamos solo lo necesario.\n`)

let bajado = 0
const resumen = []

for (const [pieza, receta] of Object.entries(PIEZAS)) {
  const pistas = []

  for (const [micro, peso] of receta.capas) {
    const entrada = elegir(archivos, micro, receta.carpeta, receta.articulacion, receta.fuerza)
    bajado += entrada.comprimido
    const flac = new URL(`${pieza}-${micro}.flac`, TEMPORAL)
    const wav = new URL(`${pieza}-${micro}.wav`, TEMPORAL)
    writeFileSync(flac, await traerArchivo(PACK, entrada))
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', flac.pathname, wav.pathname])
    pistas.push({ micro, peso, muestras: leerWav(wav.pathname), origen: entrada.nombre.split('/').pop() })
  }

  // El golpe empieza donde lo marca el micrófono principal. El mismo recorte se
  // aplica a todas las capas: si se recortara cada una por su cuenta, se
  // perdería el desfase natural entre micrófonos y la mezcla sonaría hueca.
  const principal = pistas[0].muestras
  let desde = 0
  while (desde < principal.length && Math.abs(principal[desde]) < 0.008) desde++
  desde = Math.max(0, desde - 20)

  const largo = Math.min(
    Math.round(44100 * receta.segundos),
    ...pistas.map((p) => p.muestras.length - desde),
  )

  const mezcla = new Float32Array(largo)
  for (const pista of pistas) {
    for (let i = 0; i < largo; i++) mezcla[i] += pista.muestras[desde + i] * pista.peso
  }

  // --- Procesado de estudio ---
  // Primero se deja la mezcla a un nivel de trabajo, para que el compresor
  // encuentre la señal donde espera, y al final se pone el volumen del kit.
  let señal = nivelar(mezcla, 0.7)
  señal = afinar(señal, receta.afinacion)
  señal = ecualizar(señal, receta.eq)
  señal = comprimir(señal, receta.compresor)
  // La puerta va después del compresor: comprimir levanta la cola, y es
  // justo esa cola la que hay que apagar para que el golpe suene seco.
  señal = acortar(señal, receta.puerta)
  señal = saturar(señal, receta.saturacion)
  señal = nivelar(señal, receta.nivel)
  señal = fundirFinal(señal, 0.03)

  const wavFinal = new URL(`${pieza}.wav`, TEMPORAL)
  const m4a = new URL(`${pieza}.m4a`, DESTINO)
  escribirWav(wavFinal.pathname, señal)
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wavFinal.pathname, m4a.pathname])

  const tamano = readFileSync(m4a).length
  resumen.push({
    pieza,
    origen: pistas[0].origen,
    micros: receta.capas.map(([m, p]) => `${m} ${Math.round(p * 100)} %`).join(' + '),
    proceso: `afinación ${receta.afinacion} · ${receta.eq.length} filtros · comp ${
      receta.compresor.ratio
    }:1 · puerta ${receta.puerta.mantenerMs}+${receta.puerta.caidaMs} ms`,
    duracion: largo / 44100,
    nivel: receta.nivel,
    tamano,
  })
  console.log(
    `  ${pieza.padEnd(14)} ${receta.capas.map(([m]) => m).join('+').padEnd(18)} nivel ${String(
      receta.nivel,
    ).padEnd(5)} ${(largo / 44100).toFixed(2)} s  ${(tamano / 1024).toFixed(0)} KB`,
  )
}

rmSync(TEMPORAL, { recursive: true, force: true })

const creditos = `# Sonidos de la batería

Los samples salen de **Virtuosity Drums** de Versilian Studios, publicado bajo
**Creative Commons Zero 1.0 Universal (CC0 1.0)**, es decir, dominio público:
se puede usar para cualquier fin, sin pedir permiso ni dar crédito. Aun así lo
dejamos escrito aquí.

- Pack: Virtuosity Drums v0.925
- Autor: Versilian Studios LLC
- Licencia: CC0 1.0 Universal (el texto completo viene dentro del propio pack)
- Origen: https://versilian-studios.com/virtuosity-drums/

## Cómo está mezclado

Cada golpe del pack está grabado a la vez con varios micrófonos. Aquí se mezclan
como en un estudio: el micrófono cercano aporta el golpe y la definición, y los
aéreos el aire y los platillos. El recorte del silencio inicial se calcula con el
micrófono principal y se aplica igual a todas las capas, para no perder el
desfase natural entre micrófonos.

Cada pieza se deja además a su volumen natural dentro del kit (columna "nivel"):
si todas se normalizaran al máximo, el hi-hat sonaría tan fuerte como el bombo.

## Procesado

Los samples crudos suenan a grabación de sala, no a disco. Cada pieza pasa por
la misma cadena que usaría un ingeniero al mezclar: ecualización propia (quitar
el "cartón" de los toms, sacar el golpe del bombo, el crack de la tarola),
compresión para darle pegada, una puerta que apaga la resonancia (el golpe
suena seco, como un tambor con trapo) y una pizca de saturación. A los tambores
se les baja además la afinación: el pack es un kit de jazz, con tambores chicos
y agudos, y bajarlos los convierte en un kit más grande. Está todo en
\`herramientas/audio-dsp.mjs\`.

Todo acaba en mono 44,1 kHz y AAC (.m4a), que es lo que reproduce Safari en iPhone.

Para regenerarlos: \`npm run samples\`.

| Pieza | Micrófonos | Procesado | Nivel | Duración | Tamaño |
|---|---|---|---|---|---|
${resumen.map((r) => `| ${r.pieza} | ${r.micros} | ${r.proceso} | ${r.nivel} | ${r.duracion.toFixed(2)} s | ${(r.tamano / 1024).toFixed(0)} KB |`).join('\n')}

El tom de piso no tiene sample propio: el pack solo trae dos toms, así que se
reproduce el tom grave con la afinación bajada.
`
writeFileSync(new URL('CREDITOS.md', DESTINO), creditos)

const totalKb = resumen.reduce((t, r) => t + r.tamano, 0) / 1024
console.log(`\nBajados ${(bajado / 1e6).toFixed(1)} MB del pack.`)
console.log(`Sonidos listos en public/sonidos/: ${totalKb.toFixed(0)} KB en total.`)
