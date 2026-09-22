// Punto de entrada de la app.
import './ui/estilos.css'
import { montarPantallaInicio } from './ui/pantalla-inicio'
import { registrarServiceWorker } from './sistema/pwa'

const raiz = document.querySelector<HTMLDivElement>('#app')
if (!raiz) throw new Error('No se encontró el contenedor #app')

montarPantallaInicio(raiz)
registrarServiceWorker()
