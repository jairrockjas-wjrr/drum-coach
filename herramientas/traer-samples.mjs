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
    afinacion: 0.78, // bombo de rock, bien grande
    eq: [
      { tipo: 'pasaaltos', frecuencia: 25 },
      { tipo: 'graves', frecuencia: 52, db: 9 }, // el "gordo"
      { tipo: 'pico', frecuencia: 400, q: 1.1, db: -7 }, // fuera el cartón
      { tipo: 'pico', frecuencia: 2200, q: 1.4, db: 2 }, // lo justo para oírlo
      { tipo: 'agudos', frecuencia: 5500, db: -6 }, // menos agudo
    ],
    compresor: { umbralDb: -15, ratio: 5, ataqueMs: 12, soltarMs: 110, compensarDb: 4 },
    puerta: { mantenerMs: 95, caidaMs: 320 },
    saturacion: 0.28,
    nivel: 0.94,
    segundos: 0.9,
  },
  tarola: {
    carpeta: 'snare',
    articulacion: 'center',
    capas: [['snaremic', 1], ['oh', 0.3], ['room', 0.12]],
    fuerza: 0.85,
    afinacion: 0.88, // tarola de rock, más grave
    eq: [
      { tipo: 'pasaaltos', frecuencia: 75 },
      { tipo: 'pico', frecuencia: 175, q: 1, db: 5 }, // cuerpo
      { tipo: 'pico', frecuencia: 850, q: 1.2, db: -4 },
      { tipo: 'agudos', frecuencia: 6000, db: 1 }, // apenas un toque de crack
    ],
    compresor: { umbralDb: -17, ratio: 5, ataqueMs: 4, soltarMs: 120, compensarDb: 4 },
    puerta: { mantenerMs: 70, caidaMs: 320 },
    saturacion: 0.28,
    nivel: 0.92,
    segundos: 0.9,
  },
  tarolaAro: {
    carpeta: 'snare',
    articulacion: 'rimshot',
    capas: [['snaremic', 1], ['oh', 0.3], ['room', 0.14]],
    fuerza: 0.9,
    afinacion: 0.88,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 85 },
      { tipo: 'pico', frecuencia: 210, q: 1, db: 3 },
      { tipo: 'pico', frecuencia: 3200, q: 1.3, db: 2 },
      { tipo: 'agudos', frecuencia: 7000, db: -2 },
    ],
    compresor: { umbralDb: -18, ratio: 5, ataqueMs: 2, soltarMs: 130, compensarDb: 3 },
    puerta: { mantenerMs: 70, caidaMs: 310 },
    saturacion: 0.25,
    nivel: 0.95,
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
    // Referencia de Jair: hi-hat de 14" Traditional. Oscuro, con cuerpo,
    // sin el siseo agudo de un hi-hat brillante.
    afinacion: 0.95,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 230 },
      { tipo: 'pico', frecuencia: 900, q: 1.1, db: 2 }, // cuerpo del plato
      { tipo: 'pico', frecuencia: 3500, q: 1, db: -2 },
      { tipo: 'agudos', frecuencia: 9000, db: -5 }, // fuera el siseo
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
    afinacion: 0.95,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 220 },
      { tipo: 'pico', frecuencia: 900, q: 1.1, db: 2 },
      { tipo: 'agudos', frecuencia: 8500, db: -5 },
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
    afinacion: 0.95,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 200 },
      { tipo: 'agudos', frecuencia: 7000, db: -5 },
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
    // Referencia de Jair: Zildjian 20" K Constantinople. Un ride oscuro y
    // seco, con la baqueta muy clara y poco lavado brillante.
    afinacion: 0.9, // un plato más grande suena más grave
    eq: [
      { tipo: 'pasaaltos', frecuencia: 180 },
      { tipo: 'pico', frecuencia: 2600, q: 1.4, db: 3 }, // la baqueta
      { tipo: 'pico', frecuencia: 5200, q: 1, db: -3 }, // quita el filo
      { tipo: 'agudos', frecuencia: 8000, db: -6 }, // oscuro
    ],
    compresor: { umbralDb: -24, ratio: 2.5, ataqueMs: 3, soltarMs: 220, compensarDb: 2 },
    // Los platillos sí resuenan, pero un K se controla solo: cola corta.
    puerta: { mantenerMs: 700, caidaMs: 600 },
    saturacion: 0.12,
    nivel: 0.48,
    segundos: 1.8,
  },
  campana: {
    carpeta: 'ride',
    articulacion: 'bell',
    capas: [['oh', 1], ['mid', 0.3], ['room', 0.1]],
    fuerza: 0.8,
    afinacion: 0.9, // la campana del mismo ride
    eq: [
      { tipo: 'pasaaltos', frecuencia: 200 },
      { tipo: 'pico', frecuencia: 2000, q: 1.5, db: 4 },
      { tipo: 'agudos', frecuencia: 8000, db: -4 },
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
    afinacion: 0.92, // plato más grande, más grave
    eq: [
      { tipo: 'pasaaltos', frecuencia: 140 },
      { tipo: 'pico', frecuencia: 800, q: 1, db: -2 },
      { tipo: 'agudos', frecuencia: 8500, db: -4 },
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
    afinacion: 0.78, // tom de rock
    eq: [
      { tipo: 'pasaaltos', frecuencia: 50 },
      { tipo: 'graves', frecuencia: 90, db: 6 },
      { tipo: 'pico', frecuencia: 420, q: 1.3, db: -8 }, // el cartón, fuera
      { tipo: 'pico', frecuencia: 3200, q: 1.3, db: 2 }, // la baqueta, sin pasarse
      { tipo: 'agudos', frecuencia: 6000, db: -5 },
    ],
    compresor: { umbralDb: -19, ratio: 5, ataqueMs: 8, soltarMs: 200, compensarDb: 5 },
    puerta: { mantenerMs: 115, caidaMs: 460 },
    saturacion: 0.26,
    nivel: 0.85,
    segundos: 1.3,
  },
  tomMedio: {
    carpeta: 'ltom',
    articulacion: 'center',
    capas: [['mid', 1], ['oh', 0.4], ['room', 0.16]],
    fuerza: 0.85,
    afinacion: 0.77,
    eq: [
      { tipo: 'pasaaltos', frecuencia: 42 },
      { tipo: 'graves', frecuencia: 78, db: 6 },
      { tipo: 'pico', frecuencia: 380, q: 1.3, db: -8 },
      { tipo: 'pico', frecuencia: 2800, q: 1.3, db: 2 },
      { tipo: 'agudos', frecuencia: 5500, db: -5 },
    ],
    compresor: { umbralDb: -19, ratio: 5, ataqueMs: 8, soltarMs: 240, compensarDb: 5 },
    puerta: { mantenerMs: 135, caidaMs: 560 },
    saturacion: 0.26,
    nivel: 0.88,
    segundos: 1.5,
  },
}

/**
 * Variantes del kit. Son la misma grabación tratada de tres maneras, para que
 * Jair elija la que le suene bien desde los ajustes de la app.
 *
 *  afinacion: multiplica la de cada pieza (por encima de 1 = menos grave).
 *  procesado: cuánto se aplica la ecualización de cada pieza (1 = entera).
 *  puerta: multiplica la caída (por encima de 1 = deja resonar más).
 *  saturacion: multiplica la saturación.
 *  compresion: multiplica el ratio del compresor.
 */
const KITS = {
  rock: {
    nombre: 'Rock grande',
    descripcion: 'Gordo y seco. Tambores afinados abajo y bien comprimidos.',
    afinacion: 1,
    procesado: 1,
    puerta: 1,
    saturacion: 1,
    compresion: 1,
  },
  estudio: {
    nombre: 'Estudio seco',
    descripcion: 'Más apretado y con más ataque, menos grave. Sonido de disco.',
    afinacion: 1.07,
    procesado: 0.85,
    puerta: 0.7,
    saturacion: 0.8,
    compresion: 1.1,
  },
  natural: {
    nombre: 'Natural',
    descripcion: 'Casi sin tocar: la batería como se grabó, con su resonancia.',
    afinacion: 1.14,
    procesado: 0.3,
    puerta: 2.4,
    saturacion: 0.25,
    compresion: 0.6,
  },
}

/** Aplica una variante a la receta de una pieza. */
function aplicarKit(receta, kit) {
  return {
    ...receta,
    afinacion: Math.min(1.05, receta.afinacion * kit.afinacion),
    eq: receta.eq.map((banda) => ({ ...banda, db: (banda.db ?? 0) * kit.procesado })),
    compresor: {
      ...receta.compresor,
      ratio: Math.max(1.2, receta.compresor.ratio * kit.compresion),
      compensarDb: (receta.compresor.compensarDb ?? 0) * kit.procesado,
    },
    puerta: {
      mantenerMs: receta.puerta.mantenerMs,
      caidaMs: Math.round(receta.puerta.caidaMs * kit.puerta),
    },
    saturacion: receta.saturacion * kit.saturacion,
  }
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
  // --- Las capas se bajan una sola vez y sirven para las tres variantes ---
  const pistas = []
  for (const [micro, peso] of receta.capas) {
    const entrada = elegir(archivos, micro, receta.carpeta, receta.articulacion, receta.fuerza)
    bajado += entrada.comprimido
    const flac = new URL(`${pieza}-${micro}.flac`, TEMPORAL)
    const wav = new URL(`${pieza}-${micro}.wav`, TEMPORAL)
    writeFileSync(flac, await traerArchivo(PACK, entrada))
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', flac.pathname, wav.pathname])
    pistas.push({ peso, muestras: leerWav(wav.pathname), origen: entrada.nombre.split('/').pop() })
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

  const linea = [pieza.padEnd(14)]

  for (const [id, kit] of Object.entries(KITS)) {
    const ajustada = aplicarKit(receta, kit)
    mkdirSync(new URL(`${id}/`, DESTINO), { recursive: true })

    // --- Procesado de estudio ---
    // Primero se deja la mezcla a un nivel de trabajo, para que el compresor
    // encuentre la señal donde espera, y al final se pone el volumen del kit.
    let señal = nivelar(mezcla, 0.7)
    señal = afinar(señal, ajustada.afinacion)
    señal = ecualizar(señal, ajustada.eq)
    señal = comprimir(señal, ajustada.compresor)
    // La puerta va después del compresor: comprimir levanta la cola, y es
    // justo esa cola la que hay que apagar para que el golpe suene seco.
    señal = acortar(señal, ajustada.puerta)
    señal = saturar(señal, ajustada.saturacion)
    señal = nivelar(señal, receta.nivel)
    señal = fundirFinal(señal, 0.03)

    const wavFinal = new URL(`${pieza}-${id}.wav`, TEMPORAL)
    const m4a = new URL(`${id}/${pieza}.m4a`, DESTINO)
    escribirWav(wavFinal.pathname, señal)
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wavFinal.pathname, m4a.pathname])

    const tamano = readFileSync(m4a).length
    resumen.push({ kit: id, pieza, tamano, duracion: señal.length / 44100 })
    linea.push(`${id} ${(señal.length / 44100).toFixed(2)}s/${(tamano / 1024).toFixed(0)}KB`)
  }

  console.log('  ' + linea.join('  '))
}

rmSync(TEMPORAL, { recursive: true, force: true })

const porKit = Object.keys(KITS).map((id) => ({
  id,
  ...KITS[id],
  tamano: resumen.filter((r) => r.kit === id).reduce((t, r) => t + r.tamano, 0),
}))

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

## Procesado

Los samples crudos suenan a grabación de sala, no a disco. Cada pieza pasa por
la misma cadena que usaría un ingeniero al mezclar: ecualización propia,
compresión para darle pegada, una puerta que apaga la resonancia (el golpe
suena seco, como un tambor con trapo) y una pizca de saturación. A los tambores
se les baja además la afinación: el pack es un kit de jazz, con tambores chicos
y agudos, y bajarlos los convierte en un kit más grande. Está todo en
\`herramientas/audio-dsp.mjs\`.

Los platillos van hacia las referencias que pidió Jair: un hi-hat de 14"
Traditional y un Zildjian 20" K Constantinople (oscuros, nada brillantes).

## Variantes

La misma grabación sale en tres kits; se elige desde los ajustes de la app y
solo se descarga el elegido.

| Kit | Cómo suena | Pesa |
|---|---|---|
${porKit.map((k) => `| **${k.nombre}** (\`${k.id}\`) | ${k.descripcion} | ${(k.tamano / 1024).toFixed(0)} KB |`).join('\n')}

Todo acaba en mono 44,1 kHz y AAC (.m4a), que es lo que reproduce Safari en iPhone.

Para regenerarlos: \`npm run samples\`.
`
writeFileSync(new URL('CREDITOS.md', DESTINO), creditos)

console.log(`\nBajados ${(bajado / 1e6).toFixed(1)} MB del pack.`)
for (const kit of porKit) {
  console.log(`  ${kit.nombre.padEnd(14)} ${(kit.tamano / 1024).toFixed(0)} KB`)
}
