// Biblioteca privada: las partituras que tú importas.
//
// Vive en IndexedDB, dentro de tu navegador, en este teléfono. Drum Coach no
// tiene servidor ni cuentas, así que no hay ningún sitio al que esto pueda
// viajar aunque quisiera. Tampoco hay botón de compartir ni de exportar: si
// algo de aquí sale del teléfono, es porque tú lo sacaste a mano.
//
// Se usa IndexedDB y no localStorage porque una foto de una página ocupa
// megas y localStorage se llena a los cinco.

import type { Pieza } from '../ejercicios/tipos'
import type { Rejilla } from './rejilla'

const BASE = 'drum-coach-taller'
const ALMACEN = 'partituras'

export interface Partitura {
  id: string
  titulo: string
  /** Cuándo se guardó, en milisegundos. */
  cuando: number
  bpm: number
  piezas: Pieza[]
  rejilla: Rejilla
  /** La foto de la que se copió, para poder mirarla al corregir. */
  imagen?: Blob
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((listo, falla) => {
    const peticion = indexedDB.open(BASE, 1)
    peticion.onupgradeneeded = () => {
      const base = peticion.result
      if (!base.objectStoreNames.contains(ALMACEN)) {
        base.createObjectStore(ALMACEN, { keyPath: 'id' })
      }
    }
    peticion.onsuccess = () => listo(peticion.result)
    peticion.onerror = () => falla(peticion.error)
  })
}

/** Envuelve una petición de IndexedDB en una promesa, que es más legible. */
function esperar<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((listo, falla) => {
    peticion.onsuccess = () => listo(peticion.result)
    peticion.onerror = () => falla(peticion.error)
  })
}

export async function guardarPartitura(partitura: Partitura): Promise<void> {
  const base = await abrir()
  const trato = base.transaction(ALMACEN, 'readwrite')
  await esperar(trato.objectStore(ALMACEN).put(partitura))
  base.close()
}

export async function listarPartituras(): Promise<Partitura[]> {
  const base = await abrir()
  const trato = base.transaction(ALMACEN, 'readonly')
  const todas = await esperar(trato.objectStore(ALMACEN).getAll() as IDBRequest<Partitura[]>)
  base.close()
  // Las más nuevas arriba.
  return todas.sort((a, b) => b.cuando - a.cuando)
}

export async function buscarPartitura(id: string): Promise<Partitura | undefined> {
  const base = await abrir()
  const trato = base.transaction(ALMACEN, 'readonly')
  const una = await esperar(trato.objectStore(ALMACEN).get(id) as IDBRequest<Partitura | undefined>)
  base.close()
  return una
}

export async function borrarPartitura(id: string): Promise<void> {
  const base = await abrir()
  const trato = base.transaction(ALMACEN, 'readwrite')
  await esperar(trato.objectStore(ALMACEN).delete(id))
  base.close()
}

/** Identificador nuevo. El prefijo distingue lo tuyo de lo que trae la app. */
export function nuevoId(): string {
  return `mio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
