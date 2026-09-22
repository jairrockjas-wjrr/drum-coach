// Guardado local de preferencias. Todo se queda en el teléfono (localStorage),
// no hay servidor ni cuentas. Si el guardado falla (modo privado de Safari),
// la app sigue funcionando con los valores por defecto.

const PREFIJO = 'drum-coach:'

export function guardar<T>(clave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    // Sin espacio o en modo privado: no es grave, seguimos sin guardar.
  }
}

/**
 * Lee un valor guardado y lo mezcla con los valores por defecto.
 * Así, cuando la app gane opciones nuevas, las configuraciones viejas siguen sirviendo.
 */
export function leer<T extends object>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave)
    if (!crudo) return porDefecto
    const guardado = JSON.parse(crudo) as Partial<T>
    return combinar(porDefecto, guardado)
  } catch {
    return porDefecto
  }
}

/** Mezcla superficial pero recursiva en objetos anidados (entrenador, silencio…). */
function combinar<T extends object>(base: T, encima: Partial<T>): T {
  const resultado = { ...base }
  for (const clave of Object.keys(encima) as (keyof T)[]) {
    const valor = encima[clave]
    if (valor === undefined || valor === null) continue
    const actual = base[clave]
    if (typeof actual === 'object' && actual !== null && !Array.isArray(actual)) {
      resultado[clave] = combinar(actual as object, valor as object) as T[keyof T]
    } else if (typeof valor === typeof actual) {
      resultado[clave] = valor as T[keyof T]
    }
  }
  return resultado
}
