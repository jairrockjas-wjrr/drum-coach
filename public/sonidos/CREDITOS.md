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
compresión para darle pegada, una puerta que apaga la resonancia (el golpe
suena seco, como un tambor con trapo) y una pizca de saturación. A los tambores
se les baja además la afinación: el pack es un kit de jazz, con tambores chicos
y agudos, y bajarlos los convierte en un kit más grande. Está todo en
`herramientas/audio-dsp.mjs`.

Todo acaba en mono 44,1 kHz y AAC (.m4a), que es lo que reproduce Safari en iPhone.

Para regenerarlos: `npm run samples`.

| Pieza | Micrófonos | Procesado | Nivel | Duración | Tamaño |
|---|---|---|---|---|---|
| bombo | kickmic 100 % + mid 30 % | afinación 0.86 · 5 filtros · comp 4:1 · puerta 85+270 ms | 1 | 0.90 s | 7 KB |
| tarola | snaremic 100 % + oh 30 % + room 12 % | afinación 0.93 · 4 filtros · comp 4:1 · puerta 65+290 ms | 0.92 | 0.90 s | 9 KB |
| tarolaAro | snaremic 100 % + oh 30 % + room 14 % | afinación 0.93 · 4 filtros · comp 5:1 · puerta 70+310 ms | 1 | 0.90 s | 9 KB |
| aro | snaremic 100 % + oh 20 % | afinación 0.95 · 3 filtros · comp 3:1 · puerta 25+110 ms | 0.52 | 0.60 s | 6 KB |
| hiHatCerrado | oh 100 % + snaremic 30 % | afinación 1 · 3 filtros · comp 2.5:1 · puerta 30+150 ms | 0.4 | 0.45 s | 7 KB |
| hiHatAbierto | oh 100 % + snaremic 25 % + room 10 % | afinación 1 · 2 filtros · comp 2.5:1 · puerta 260+600 ms | 0.5 | 1.20 s | 15 KB |
| hiHatPedal | oh 100 % + snaremic 30 % | afinación 1 · 2 filtros · comp 3:1 · puerta 25+130 ms | 0.3 | 0.45 s | 6 KB |
| ride | oh 100 % + mid 30 % + room 10 % | afinación 1 · 3 filtros · comp 2.5:1 · puerta 900+700 ms | 0.48 | 1.80 s | 27 KB |
| campana | oh 100 % + mid 30 % + room 10 % | afinación 1 · 3 filtros · comp 3:1 · puerta 700+600 ms | 0.56 | 1.50 s | 22 KB |
| crash | oh 100 % + mid 35 % + room 20 % | afinación 1 · 3 filtros · comp 2:1 · puerta 1400+900 ms | 0.78 | 2.40 s | 36 KB |
| tomAgudo | mid 100 % + oh 40 % + room 16 % | afinación 0.86 · 5 filtros · comp 4:1 · puerta 105+400 ms | 0.85 | 1.30 s | 10 KB |
| tomMedio | mid 100 % + oh 40 % + room 16 % | afinación 0.85 · 5 filtros · comp 4:1 · puerta 125+500 ms | 0.88 | 1.50 s | 10 KB |

El tom de piso no tiene sample propio: el pack solo trae dos toms, así que se
reproduce el tom grave con la afinación bajada.
