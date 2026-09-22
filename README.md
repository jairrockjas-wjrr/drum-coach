# Drum Coach

App de práctica de batería para iPhone (PWA instalable). Personal, sin cuentas,
sin servidor y sin conexión: todos los datos se guardan en el propio teléfono.

**App publicada:** https://jairrockjas-wjrr.github.io/drum-coach/

## Estado

- [x] Fase 1 — Proyecto base, PWA y publicación automática
- [x] Fase 2 — Metrónomo
- [ ] Fase 3 — Reproductor de ejercicios con partitura
- [ ] Fase 4 — Lectura desde cero
- [ ] Fase 5 — Jazz
- [ ] Fase 6 — Doble pedal
- [ ] Fase 7 — Generador de remates
- [ ] Fase 8 — Biblioteca de ritmos
- [ ] Fase 9 — Rutina y progreso

## Cómo trabajar en el proyecto

```bash
npm install          # solo la primera vez
npm run dev          # servidor local (también accesible desde el iPhone en la misma Wi-Fi)
npm run build        # revisa tipos y compila a dist/
npm run iconos       # regenera los íconos PNG de la app
```

Prueba de precisión del metrónomo (solo en desarrollo):
<http://localhost:5173/pruebas/precision.html>. Mide la desviación de cada pulso
contra el instante ideal y el margen con el que se alcanzó a programar cada click.

Al hacer `git push` a `main`, GitHub Actions compila y publica sola la app.

## Organización del código

```
src/
  audio/      motor de sonido (AudioContext, click del metrónomo)
  metronomo/  scheduler de lookahead y tipos del metrónomo
  ui/         pantallas, navegación y estilos
  sistema/    integración con el teléfono (PWA, pantalla encendida)
  datos/      ejercicios y guardado local
public/       manifest, service worker e íconos
pruebas/      páginas de prueba manuales (solo en desarrollo)
herramientas/ scripts de apoyo (generador de íconos)
```

## El BPM y los compases compuestos

En esta app el BPM siempre son **pulsos** por minuto. En 4/4, 3/4 y 5/4 son negras;
en 6/8, 7/8 y 12/8 son corcheas, que es como se practica normalmente con metrónomo.
La pantalla lo indica debajo del número.

## Notas de iPhone / Safari

- El audio solo arranca tras un toque del usuario: se desbloquea en el primer tap.
- `navigator.audioSession.type = 'playback'` (iOS 16.4+) hace que la app suene aunque
  el interruptor lateral esté en silencio. En iOS anteriores no hay alternativa desde
  la web: hay que subir el interruptor o usar audífonos.
- La pantalla se mantiene encendida con la Screen Wake Lock API (iOS 16.4+).
- El click **nunca** se programa con `setInterval`/`setTimeout`: siempre con el reloj
  de audio (`audioContext.currentTime`), que es el único preciso.

## Contenido

Todos los ejercicios, ritmos y remates son originales o generados por la app.
No se copia material de libros ni de apps de pago.
