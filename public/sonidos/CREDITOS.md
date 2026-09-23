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

## Procesado

Los samples crudos suenan a grabación de sala, no a disco. Cada pieza pasa por
la misma cadena que usaría un ingeniero al mezclar: ecualización propia,
compresión para darle pegada, una puerta que apaga la resonancia (el golpe
suena seco, como un tambor con trapo) y una pizca de saturación. A los tambores
se les baja además la afinación: el pack es un kit de jazz, con tambores chicos
y agudos, y bajarlos los convierte en un kit más grande. Está todo en
`herramientas/audio-dsp.mjs`.

Los platillos van hacia las referencias que pidió Jair: un hi-hat de 14"
Traditional y un Zildjian 20" K Constantinople (oscuros, nada brillantes).

## Variantes

La misma grabación sale en tres kits; se elige desde los ajustes de la app y
solo se descarga el elegido.

| Kit | Cómo suena | Pesa |
|---|---|---|
| **Rock grande** (`rock`) | Gordo y seco. Tambores afinados abajo y bien comprimidos. | 171 KB |
| **Estudio seco** (`estudio`) | Más apretado y con más ataque, menos grave. Sonido de disco. | 152 KB |
| **Natural** (`natural`) | Casi sin tocar: la batería como se grabó, con su resonancia. | 213 KB |

Todo acaba en mono 44,1 kHz y AAC (.m4a), que es lo que reproduce Safari en iPhone.

Para regenerarlos: `npm run samples`.
