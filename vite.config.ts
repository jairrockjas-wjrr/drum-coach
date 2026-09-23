import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

// Identificador de la compilación, para saber desde el teléfono qué versión
// está corriendo (el caché de Safari a veces sirve una vieja).
const compilacion = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
})()

// La app se publica en https://<usuario>.github.io/drum-coach/,
// por eso todas las rutas cuelgan de /drum-coach/ en producción.
// En desarrollo (npm run dev) la base es "/" para que funcione en localhost.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/drum-coach/' : '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  define: {
    __COMPILACION__: JSON.stringify(compilacion),
  },
}))
