# Sonidos de la batería

Los samples de la batería salen de **Virtuosity Drums** de Versilian Studios,
publicado bajo **Creative Commons Zero 1.0 Universal (CC0 1.0)**, es decir,
dominio público: se puede usar para cualquier fin, sin pedir permiso ni dar
crédito. Aun así lo dejamos escrito aquí.

- Pack: Virtuosity Drums v0.925
- Autor: Versilian Studios LLC
- Licencia: CC0 1.0 Universal (el texto completo viene dentro del propio pack)
- Origen: https://versilian-studios.com/virtuosity-drums/

Toma de micrófono usada: `mid`. Cada archivo se pasó a mono 44,1 kHz, se
recortó el silencio inicial, se normalizó y se guardó en AAC (.m4a), que es el
formato que reproduce Safari en el iPhone.

Para regenerarlos: `npm run samples`.

| Pieza | Archivo original | Duración | Tamaño |
|---|---|---|---|
| bombo | `mid_kick_snon_vl4_rr1.flac` | 1.00 s | 15 KB |
| tarola | `mid_snare_center_vl29.flac` | 1.00 s | 15 KB |
| tarolaAro | `mid_snare_rimshot_vl10.flac` | 1.10 s | 16 KB |
| aro | `mid_snare_crossstick_vl13.flac` | 0.70 s | 12 KB |
| hiHatCerrado | `mid_hh_closed_vl3_rr1.flac` | 0.50 s | 10 KB |
| hiHatAbierto | `mid_hh_open_vl3_rr1.flac` | 1.40 s | 20 KB |
| hiHatPedal | `mid_hh_pedal_vl3_rr1.flac` | 0.50 s | 10 KB |
| ride | `mid_ride_ride_vl2_rr1.flac` | 1.80 s | 27 KB |
| campana | `mid_ride_bell_vl2_rr1.flac` | 1.50 s | 23 KB |
| crash | `mid_crash_crash_vl2_rr1.flac` | 2.60 s | 34 KB |
| tomAgudo | `mid_htom_center_vl13.flac` | 1.30 s | 18 KB |
| tomMedio | `mid_ltom_center_vl13.flac` | 1.50 s | 20 KB |

El tom de piso no tiene sample propio: el pack solo trae dos toms, así que se
reproduce el tom grave con la afinación bajada.
