// Genera los íconos PNG de la app sin depender de librerías externas.
// Dibuja un parche de batería visto desde arriba (aro ámbar + tornillos)
// sobre fondo oscuro. Se ejecuta con: npm run iconos
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// --- Utilidades mínimas para escribir un PNG (RGBA, 8 bits) ---
const tablaCrc = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = tablaCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

function escribirPng(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  // Cada fila lleva delante un byte de filtro (0 = sin filtro)
  const crudo = Buffer.alloc(alto * (ancho * 4 + 1))
  for (let y = 0; y < alto; y++) {
    crudo[y * (ancho * 4 + 1)] = 0
    pixeles.copy(crudo, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

// --- Dibujo del ícono ---
const FONDO = [13, 15, 19]
const AMBAR = [242, 163, 60]
const PARCHE = [233, 229, 220]
const ARO = [90, 97, 110]

function mezclar(base, color, alfa) {
  return [
    Math.round(base[0] + (color[0] - base[0]) * alfa),
    Math.round(base[1] + (color[1] - base[1]) * alfa),
    Math.round(base[2] + (color[2] - base[2]) * alfa),
  ]
}

// Cobertura suavizada de un anillo/círculo: devuelve 0..1 según la distancia
function cobertura(distancia, radio, suavizado = 1.2) {
  return Math.min(1, Math.max(0, (radio - distancia) / suavizado + 0.5))
}

function dibujar(tamano, escalaContenido) {
  const px = Buffer.alloc(tamano * tamano * 4)
  const centro = tamano / 2
  const r = (tamano / 2) * escalaContenido // radio del tambor
  const rAro = r
  const rParche = r * 0.82
  const rCentro = r * 0.16
  const rTornillo = r * 0.062
  const dTornillo = r * 0.91

  // Posiciones de los 8 tornillos alrededor del aro
  const tornillos = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    tornillos.push([centro + Math.cos(a) * dTornillo, centro + Math.sin(a) * dTornillo])
  }

  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      const d = Math.hypot(cx - centro, cy - centro)
      let color = FONDO

      // Aro exterior ámbar
      color = mezclar(color, AMBAR, cobertura(d, rAro, tamano / 160))
      // Parche claro
      color = mezclar(color, PARCHE, cobertura(d, rParche, tamano / 160))
      // Sombra sutil del aro interno
      color = mezclar(color, ARO, cobertura(d, rParche * 0.995, tamano / 160) * 0.18)
      // Centro ámbar
      color = mezclar(color, AMBAR, cobertura(d, rCentro, tamano / 160))
      // Tornillos
      for (const [tx, ty] of tornillos) {
        const dt = Math.hypot(cx - tx, cy - ty)
        color = mezclar(color, [26, 29, 36], cobertura(dt, rTornillo, tamano / 200))
      }

      const i = (y * tamano + x) * 4
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255 // opaco: iOS no admite transparencia en el ícono de inicio
    }
  }
  return escribirPng(tamano, tamano, px)
}

mkdirSync(new URL('../public/iconos/', import.meta.url), { recursive: true })
const salidas = [
  ['icono-180.png', 180, 0.86],
  ['icono-192.png', 192, 0.86],
  ['icono-512.png', 512, 0.86],
  // "Maskable": Android recorta los bordes, el dibujo va más chico y centrado
  ['icono-maskable-512.png', 512, 0.62],
]
for (const [nombre, tamano, escala] of salidas) {
  const ruta = new URL(`../public/iconos/${nombre}`, import.meta.url)
  writeFileSync(ruta, dibujar(tamano, escala))
  console.log('ícono generado:', nombre, `${tamano}x${tamano}`)
}
