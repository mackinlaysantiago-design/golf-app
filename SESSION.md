# PENDIENTE 15/10/2026 — Respuesta tarea #320: SÍ estructurar Row A/Row B (zoneReason/holeoutReason)

_Derivada desde **#golf-coach** · tarea `#322` (~/mind/tarea.sh)_

## Respuesta a la consulta #320 (coach de golf-coach)

**Conclusión: SÍ cubre un hueco real.** No es que hoy no pueda leer el motivo de falla
(lo leo en `holeNotes` y lo uso todo el tiempo) — el problema es cobertura y agregación,
no interpretación.

### 1) Qué cruce NO puedo hacer hoy con holeNotes en texto libre

- **Cobertura**: de las últimas ~20 vueltas, la mitad llega "sin SM" (sin keys ni
  relato). El motivo de falla SOLO existe cuando Santi se toma el trabajo de dictarlo
  por voz. Un chip-select de 3-5 opciones al marcar la cruz en Row A/B tiene mucha menos
  friction que narrar — daría motivo en el 100% de los hoyos rotos, no solo en los que
  él cuenta.
- **Agregación a escala**: cuando Santi pregunta "¿por qué vengo fallando Row B este
  mes?", hoy la única forma es releer holeNotes vuelta por vuelta — no escala, y en
  vueltas sin relato no hay nada que leer. Con el campo tipado + tally, es una consulta
  directa.
- **Cruce real que desbloquea**: tagear "Poor wedge shot"/"Poor contact" por hoyo y
  cruzarlo con la fecha de sesión de FlightScope de esa semana — ver si los fallos de
  contacto se concentran en semanas con smash/AOA raros en ese palo. Hoy solo detecto
  esto cuando Santi *casualmente* lo narra por voz (pasó con el 9 hierro el 13/09); si
  no lo dice, no se me ocurre ir a buscarlo.

### 2) Taxonomía — reusar la de TSM Caddie, no inventar una nueva

Ya existe, cerrada y mapeada 1:1 a los juegos de práctica (`goTo`/`chipping`/`wedges`/
`onePutt`) — confirmado en `~/golf-app/docs/knowledge-base/14_tsm_caddie_competitor_analysis.md`
(sección "Gap real 1", cruzado contra `prisma/schema.prisma` el 15/10):

- **Row A** (no llegó a la SZ en regulación) → `ZONE_REASONS`:
  `Lost ball/penalty` · `Poor contact` · `Other`
- **Row B** (no bajó en 3 o menos desde la SZ) → `HOLEOUT_REASONS`:
  `Poor wedge shot` · `Poor chip` · `Poor lag putt` · `Lost ball/penalty` · `Other`

**Nivel: por hoyo**, condicional a si esa fila falló (no por golpe, no por key). Row A/B
ya son pass/fail por hoyo en `RoundHole` (`strokesToEnterSz`/`strokesInsideSz`) — agregar
`zoneReason`/`holeoutReason` nullable al mismo nivel, sin tocar el resto del modelo.

**No reemplaza** las keys (K1-K10) ni `holeNotes` libre — son capas distintas que se
solapan parcial. El campo tipado es el filtro rápido/agregable; el texto libre sigue
sirviendo para el matiz que la taxonomía cerrada no capta (ej. el K8 de contaminación
mental del H6, que no entra limpio en ninguna opción de la lista).

### Implementación sugerida
2 campos nullable en `RoundHole` (`zoneReason`, `holeoutReason`) + chip-select en la UI
al marcar la cruz en Row A/B + 1 agregación tipo `reasonTally` en el dashboard de trends.
Poco laburo, gap real.

**Verificación de que quedó bien**: cargar una vuelta de prueba con al menos un Row A y
un Row B fallado, confirmar que el chip-select aparece solo cuando corresponde, que
queda guardado en `RoundHole`, y que el tally del mes lo cuenta.

---

# PENDIENTE 27/09/2026 — Prueba en cancha de V1x / V1 / TP5 y cruce contra el Mevo+

_Derivada desde **#web** · tarea `#198` (~/mind/tarea.sh)_

Viene del canal **web** (tarea #197, informe de pelotas). Santi va a probar en cancha las pelotas
que ya tiene y quiere seguir el tema desde acá. **No rehacer la investigación: está toda cerrada.**

## Lo ya hecho y dónde está
- Informe completo: `~/mind/tramites-web/salidas/pelota-golf-santi-2026.md` (192 líneas), con
  anexo de durabilidad y el uso real corregido. Tabla de las 48: `mygolfspy-2026-cruce-completo.txt`.
  JSON crudos `mygolfspy-raw-*.json` en la misma carpeta.
- Skill `/mygolfspy-balltest` (API abierta, sin browser) y skill `/flightscope` (radar del jugador).

## Inventario real de Santi
Pro V1x, Pro V1 común, TaylorMade TP5 y 30 Amazon Basics. **No necesita comprar nada.**

| Pelota | DISP | STOP | axis Fast | axis Mid | w35 | wFull | cover |
|---|---|---|---|---|---|---|---|
| Pro V1x | 16,0 | 2,5 | 0,60 | 0,65 | 5.967 | 10.782 | urethane |
| Pro V1 | 13,0 | 14,5 | 0,85 | 1,04 | 5.443 | 10.632 | urethane |
| TP5 | 29,8 | 9,5 | 1,22 | 2,32 | 5.592 | 10.748 | urethane |
| Amazon Basics | 23,0 | 45,0 | 3,52 | 2,57 | 4.019 | 7.567 | ionomer |

## Conclusiones ya cerradas (no re-derivar)
1. **No hay trade-off dispersión-vs-spin**: corr(axis_abs, spin wedge full) = -0,39. Las que menos
   curvan son las que más frenan.
2. **El corte grande es el cover**: urethane 10.332 rpm prom en wedge full vs ionomer 7.717.
3. **Las tres urethane frenan igual** (10.782 / 10.748 / 10.632): 150 rpm con n=11 es ruido. No
   gastar el test ahí. Se separan en el **chip de 30-40 yd** (V1x 5.967 vs V1 5.443 = ~520 rpm
   reales) y en **sidespin a velocidad media** (V1x 0,65 vs TP5 2,32).
4. **La pelota NO le arregla la dispersión de driver**: entre pelotas hay 0,4-3,7 grados; su spin
   axis va de -43,1 a +22,5 (spread lateral 127 yd). Dos órdenes de magnitud. Decírselo siempre.
5. Santi mide **111,1 mph** (rango 101,7-122,6): cae entre Driver-Fast (116) y Mid (102), y el
   ranking NO se transfiere entre condiciones (corr 0,40). Promediar las dos, nunca una sola.

## Cosa importante del uso real (corregida por él)
**En el range del club son obligatorias las pelotas del club.** Las Amazon Basics las usa EN LA
CANCHA, para los drives extra que tira por hoyo. Eso explica su "siento que pego mejores drives
con las Amazon": compara situaciones (tiro de práctica sin consecuencia, pelota blanda comp. 55
que rueda mucho) y no pelotas. Distancia y curva no transfieren (-18 yd carry pero solo -13 total;
3,52 vs 0,60 grados). Se le recomendó tirar el drive extra con la misma pelota que juega.

## Estado emocional del pedido — importante para no empujar
**Dijo textual "no estoy convencido" pero va a probar igual.** No insistir con las tablas. Lo único
que se sostiene con confianza es (a) urethane vs ionomer en el wedge (+3.200 rpm, no es ruido) y
(b) que la dispersión de driver no la arregla la pelota. Entre V1x/V1/TP5 su sensación en cancha
vale tanto como la tabla — que juegue la que le dé confianza.

## Qué queda por hacer acá
1. Cuando Santi traiga la **próxima sesión del Mevo+** después de probar las pelotas: cruzarla
   contra estos números con la skill `/flightscope`. Ver sobre todo si el **spin axis** sigue en
   el rango -43 a +22 — si sigue igual, queda confirmado que el tema es swing/fitting, no pelota.
2. Protocolo de prueba que se le dio: alternar pelota **tiro a tiro** en par 3 y aproximaciones al
   mismo green (mismo palo, mismo viento). Jugar 18 con cada una compara el día, no la pelota.
   Mirar el chip de 30-40 yd, no el driver (el driver lo tapa su propia variación).
3. Pendiente aparte: le mandó un reel de @parfect10golf (Scratch 7) sobre llevar el **codo trasero**
   a un punto en el espacio antes del release, con shallowing/caderas como consecuencia. Transcripto
   en `/tmp/xvid/t.txt` (volátil). Ojo: es un anuncio, y da DOS referencias distintas para el mismo
   punto (empeine del pie trasero en el gráfico, alineado con la pelota en el audio) sin resolverlo.
   Se le dijo que con su dispersión rinde más una clase/fitting con el Mevo+ al lado que un reel.

## Caveats que van SIEMPRE en cualquier salida
n = 11-12 tiros por pelota; la fuente avisa "treat small gaps as noise". Es robot, no él: sirve el
orden, no los rpm absolutos. El signo de `axis_tilt` no se usa (es del robot) — va `axis_abs`.

---

# PENDIENTE 27/09/2026 — Criterio de elección de pelota de golf para el tee shot de Santi (hook + swing rápido) — data del ball test ya bajada

_Derivada desde **#web** · tarea `#195` (~/mind/tarea.sh)_

## Pedido de Santi (vino por el canal web, 27/09/2026)

Santi está eligiendo pelota de golf. Quiere que **este canal determine el criterio de elección**
según sus problemas reales de juego, y que le diga **qué parámetros de golpe hacen falta medir**
además de la velocidad de driver. El relevamiento de datos ya está hecho acá; falta la parte de
coaching, que es de este canal.

### Su problema, en sus palabras
- **El tee shot es el problema principal.** "Tengo mucha distancia pero me cuesta agarrar fw."
- **Riesgo de hook, no de slice** (lo aclaró después de haber dicho al revés).
- **Swing de velocidad alta** — condición `Driver — Fast` (~116 mph) del test, no `Mid`.

### Lo que hay que responder
1. **Qué parámetros pedirle/medirle** además de velocidad de driver, para que la elección de
   pelota sea fundada: spin rate real, ángulo de salida, spin axis propio, face-to-path,
   attack angle, smash factor, dispersión medida en cancha. Decir cuáles son imprescindibles,
   cuáles son "nice to have", y **con qué los puede medir** (fitting, monitor, la app).
2. **Cómo se hace la elección** con esos datos + los del test. Un criterio explícito, no una
   recomendación sola: qué métrica pesa cuánto para un jugador rápido que pierde fairway por
   izquierda, y por qué. Ojo que "más distancia" no es su problema — ya la tiene.
3. Si el problema de fairway es de **equipo, de pelota o de swing**, y en qué orden atacarlo.
   Mi lectura desde los datos es que la pelota es el ajuste fino (todo el campo de 48 pelotas
   cabe en ~3,7° de axis tilt) y que el driver/swing pesa mucho más, pero eso lo define este canal.

### DATA YA DISPONIBLE — no volver a bajarla
MyGolfSpy 2026 Ball Test (robot, 48 pelotas, n=11-12 tiros por pelota). JSON crudos en
`~/mind/tramites-web/salidas/mygolfspy-raw-*.json` (performance + accuracy, condiciones
Driver-Fast y Driver-Mid). **El circuito completo de la API está documentado en
`~/mind/tramites-web/SESSION.md`** (endpoints, config_id por palo/velocidad, trampas).
Se baja con curl, sin browser. config_id: Driver 70=Fast 71=Mid 72=Slow, 7 Iron 67/68/69.
Campos por pelota: `axis_abs`/`axis_tilt` (sidespin), `area` (dispersión yd²), `yfc_total`
(yardas fuera del centro), `range`, spin medio (endpoint `ball_rank/5_<cfg>_spin.json`),
total, y de `ball_info`: precio, cover, compresión, capas.

### TRES COSAS YA VERIFICADAS — no rehacerlas
1. **El signo del axis tilt NO sirve para elegir.** De 6 pelotas con axis negativo en
   Driver-Fast, sólo 2 siguen negativas en Driver-Mid. El lado es del robot y del ruido, no
   de la pelota. Y la API nunca rotula izq/der (no hay label L/R ni en el JSON ni en los .js
   del dashboard). O sea: no se puede elegir "una pelota que curve al otro lado".
2. **El ranking no se transfiere entre condiciones**: correlación Fast vs Mid de `axis_abs`
   0,40 y de `area` 0,28. Hay que usar SIEMPRE la condición de su velocidad real (Fast).
3. **`area` chica + `yfc_total` alto = grupo compacto pero corrido del objetivo** (consistente,
   no preciso). Caso Amazon Basics en Fast: área 251 (2ª mejor de 48) con yfc 10,65 (la peor
   de 48). El "ranking de las más accurate" que circula publicado ordena sólo por área y por
   eso pone 1ª la Wilson Staff Model X y 2ª la Amazon Basics — las dos curvan 3,5°, o sea son
   malas para un hook. No repetir ese error.

### Mi short list desde el canal web (para que la critiquen, no para adoptarla)
Criterio que usé: 40% curva (`axis_abs`) + 25% área + 20% centrado + 15% spin bajo, en Fast.

| Pelota | U$S | Axis | Área | Fuera | Comp. | Spin | Total |
|---|---|---|---|---|---|---|---|
| Titleist Pro V1x Left Dash | 57,99 | 0,64 | 567 | 1,07 | 105 | 2357 | 326,4 |
| Vice Pro | 39,99 | 0,51 | 366 | 3,76 | 89 | 2290 | 316,7 |
| Maxfli Tour X LS | 39,99 | 0,37 | 337 | 2,35 | 97 | 2469 | 322,4 |
| Srixon Q-Star Tour | 39,99 | 0,01 | 268 | 6,22 | 70 | 2157 | 313,6 |
| Titleist Pro V1 | 57,99 | 0,85 | 322 | 3,08 | 92 | 2379 | 318,2 |

Mi razonamiento fue: Left Dash primera por spin bajo (2357) + compresión 105 que con 116 mph sí
comprime + la más larga (326,4). Descarté la Q-Star Tour por compresión 70 (la sobrecomprime) y
la Maxfli Tour X LS por spin 2469, el más alto del grupo. **Validar o corregir ese razonamiento.**

### 🔴 LO MÁS IMPORTANTE — la data que este canal tiene y el canal web no
El schema de `~/golf-app` tiene **exactamente el dato que resolvería el problema del lado**:
- `RoundHole.teeShotResult` → `L | CENTER | R`, dónde cayó cada tiro de salida
- `RoundHole.dangerSide` → `L | R | NONE`
- `RoundShot` (shot-by-shot con GPS), `Player.goToClubOffTheTee`, `Player.goToClubReason`

**La `dev.db` local está vacía (0 rondas).** La data de producción está en Neon
(`ep-winter-moon-ang25sse`). Si Santi tiene rondas cargadas ahí, salen dos cosas que valen más
que todo el test de robot: **su % real de fairways agarrados** y **la distribución L/CENTER/R de
sus fallas**, o sea su sesgo medido en cancha en vez de inferido. Con eso la recomendación deja
de ser teórica.

Si no hay rondas cargadas, decírselo y proponerle qué empezar a registrar (y si la app ya lo
soporta o le falta pantalla) — eso convierte el pedido en una feature del canal.

### Cómo cerrar
Contestarle a Santi por el canal de Discord con: (a) la lista de parámetros a medir y con qué,
(b) el criterio de elección explícito, (c) la recomendación final de pelota o el pedido concreto
de datos que falta. Y `~/mind/vuelta.sh hecho <id> "..."` cuando esté.

---

# RESUELTO 11/09/2026 — Dictado de hoyo completo por voz

Implementado en `main` (commit `b4c4bc3`): botón "🎙 Dictar hoyo" en `RondaTracker.tsx` que
graba, manda a `/api/rondas/[id]/hoyos/voice` (Gemini 2.5 Flash, mismo patrón que
`gemini-shot.ts`), y muestra editable score/putts/penalidades/enter-inside SZ/distancia
REG/keys rotas/bandera/dangerSide/aimedAtCenter/recoveryMode antes de aplicar. No
autoguarda: el "💾 Guardar" de siempre sigue siendo el que persiste.

Sin probar en dispositivo real con micrófono (typecheck + build + gemini-review OK).
Falta: usarlo en cancha y ajustar el prompt si Gemini interpreta mal algo.

---

# PENDIENTE (original, ya resuelto arriba) — Pipeline de voz post-hoyo/post-multa con analizador de contexto de golf

_Derivada desde **#central/infra** · tarea `#106` (~/mind/tarea.sh)_

Pedido de Santi (10/09/2026, sesión golf-coach): quiere un pipeline de nota de voz post-ronda
(post-multa o post-hoyo problemático) con un analizador que transcriba teniendo en cuenta el
contexto de golf (hoyo, palo, situación), tomando como referencia el patrón ya implementado en
kine-bot (voz + analizador con contexto).

Caso de uso: hoy la causa de una multa o error en golf solo queda registrada si Santi se la
cuenta de palabra al coach dentro de la conversación — no hay forma de cargarla en la app
(~/golf-app) sin escribir. Se busca que grabe un audio corto (ej. "hoyo 9, fui con el 4 hierro
en vez del layup, se me fue afuera") y quede transcripto y asociado al hoyo/ronda correspondiente
(candidato: extender RoundHole con un campo tipo notes/causeNotes, o nuevo modelo si corresponde).

Por qué importa: en la sesión de golf-coach del 10/09/2026 se armó un puente de golpes
(par + excedente de approach + multas − ganancia de putting, con datos reales de ~golf-coach/
garmin_full.json) que mostró que el mayor leak de Santi está en la SEVERIDAD de los misses de
approach (K6 Tiros Riesgosos, K7 Short Siding) y en las causas de multa (K2) — no en la
frecuencia de GIR/FIR, que ya está en línea con jugadores de mejor nivel. Esa causa hoy se
pierde si no se conversa explícitamente con el coach.

Pedido explícito: evaluar construir este flujo de voz con analizador contextual para golf-app, usando kine-bot (~/kine-bot) como referencia de arquitectura. Viene de la central (tarea #104, pedido de Santi en la sesión golf-coach del 10/09).

---

