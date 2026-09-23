// Permite que las pruebas importen los módulos .ts del proyecto tal como están
// escritos: el código importa sin extensión ("./tipos"), como es costumbre con
// Vite, y Node exige la extensión. Aquí se la añadimos al vuelo.
// Se usa con: node --import ./pruebas/resolver.mjs
import { registerHooks } from 'node:module'

registerHooks({
  resolve(especificador, contexto, siguiente) {
    const esRelativo = especificador.startsWith('./') || especificador.startsWith('../')
    if (esRelativo && !/\.[a-z]+$/i.test(especificador)) {
      try {
        return siguiente(especificador + '.ts', contexto)
      } catch {
        // Si no era un .ts, seguimos con la resolución normal.
      }
    }
    return siguiente(especificador, contexto)
  },
})
