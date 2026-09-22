import { defineConfig } from 'vite'

// La app se publica en https://<usuario>.github.io/drum-coach/,
// por eso todas las rutas cuelgan de /drum-coach/ en producción.
// En desarrollo (npm run dev) la base es "/" para que funcione en localhost.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/drum-coach/' : '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
}))
