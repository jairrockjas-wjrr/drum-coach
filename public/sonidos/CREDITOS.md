# Sonidos de la batería

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
compresión para darle pegada y sostenido, y una pizca de saturación para
redondear los picos. Está todo en `herramientas/audio-dsp.mjs`.

Todo acaba en mono 44,1 kHz y AAC (.m4a), que es lo que reproduce Safari en iPhone.

Para regenerarlos: `npm run samples`.

| Pieza | Micrófonos | Procesado | Nivel | Duración | Tamaño |
|---|---|---|---|---|---|
| bombo | kickmic 100 % + mid 35 % | 4 filtros · comp 4:1 · sat 18 % | 0.98 | 0.90 s | 15 KB |
| tarola | snaremic 100 % + oh 35 % + room 18 % | 4 filtros · comp 4:1 · sat 22 % | 0.9 | 0.95 s | 17 KB |
| tarolaAro | snaremic 100 % + oh 35 % + room 20 % | 4 filtros · comp 5:1 · sat 25 % | 1 | 1.00 s | 18 KB |
| aro | snaremic 100 % + oh 25 % | 3 filtros · comp 3:1 · sat 15 % | 0.52 | 0.60 s | 12 KB |
| hiHatCerrado | oh 100 % + snaremic 30 % | 3 filtros · comp 2.5:1 · sat 10 % | 0.4 | 0.45 s | 11 KB |
| hiHatAbierto | oh 100 % + snaremic 25 % + room 12 % | 2 filtros · comp 2.5:1 · sat 10 % | 0.5 | 1.30 s | 22 KB |
| hiHatPedal | oh 100 % + snaremic 30 % | 2 filtros · comp 3:1 · sat 10 % | 0.3 | 0.45 s | 11 KB |
| ride | oh 100 % + mid 30 % + room 12 % | 3 filtros · comp 2.5:1 · sat 12 % | 0.48 | 1.80 s | 33 KB |
| campana | oh 100 % + mid 30 % + room 12 % | 3 filtros · comp 3:1 · sat 12 % | 0.56 | 1.50 s | 28 KB |
| crash | oh 100 % + mid 35 % + room 22 % | 3 filtros · comp 2:1 · sat 10 % | 0.78 | 2.40 s | 41 KB |
| tomAgudo | mid 100 % + oh 45 % + room 22 % | 4 filtros · comp 4:1 · sat 20 % | 0.82 | 1.30 s | 23 KB |
| tomMedio | mid 100 % + oh 45 % + room 22 % | 4 filtros · comp 4:1 · sat 20 % | 0.85 | 1.50 s | 26 KB |

El tom de piso no tiene sample propio: el pack solo trae dos toms, así que se
reproduce el tom grave con la afinación bajada.
