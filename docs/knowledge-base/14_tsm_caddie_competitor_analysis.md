# TSM Caddie (tsmcaddie.com) — Análisis de la app oficial de The Scoring Method

Investigación de referencia (no afecta el código de golf-app). Es una PWA Expo Router
(React Native Web), bundle JS único, sin backend propio salvo un par de endpoints
serverless (`/api/signup`, `/api/leaderboard`). Todo el dato del jugador vive en
AsyncStorage del dispositivo — no hay cuenta con password, ni sync multi-dispositivo
salvo el leaderboard opcional.

Fuente: `https://tsmcaddie.com/_expo/static/js/web/index-934a26d6699ec7b6f1a8e768cfb67a66.js`
(2.9MB, bajado y analizado el 2026-10-15). Hash del bundle cambia con cada deploy de
ellos, así que este análisis es una foto de ese momento.

## 1. Pantallas / Rutas (Expo Router → React Navigation stack)

Lista completa sacada del `Navigator` raíz (antes solo se sabía una parte):

| Ruta | Pantalla |
|---|---|
| `Home` | Home |
| `Settings` | Settings — perfil, targets de práctica, cuenta |
| `History` | Rounds (listado histórico) |
| `Trends` | Trends (resumen de tendencias) |
| `TrendDetail` | Detalle de una fila/trend específica |
| `NewRound` | Alta de ronda nueva |
| `Hole` | Hoyo por hoyo (pantalla central del logging) |
| `RoundSummary` | Resumen de la ronda jugada |
| `Practice` | Práctica prescripta post-ronda |
| `ScorecardPreview` | Preview/PDF de tarjeta (scorecard, practice, wedge, combine) |
| `WedgeMatrix` | Matriz de distancias de wedges |
| `WedgeBox` | Detalle/edición de una caja de la matriz |
| `WedgeSession` | Sesión de medición de wedge |
| `Combine` | Hub de "The Combine" (test suite de habilidad) — **nuevo, no documentado antes** |
| `CombineIntro` | Intro/instrucciones de un test del Combine |
| `CombineTest` | Ejecución de un test del Combine |
| `CombineTestDone` | Pantalla de test completado |
| `CombineSummary` | Resumen/score card del Combine |
| `Leaderboard` | Tabla de posiciones — **nuevo, no documentado antes** |
| `LeaderboardPlayer` | Detalle de un jugador del leaderboard |

Antes de cargar cualquier pantalla, la app resuelve un flujo de signup: `loading` →
`needsEmail` (pantalla de alta de mail, sin password) → stack normal. Antes del login
inicial no hay pantallas de golf, solo captura de email.

## 2. Sistema "Five Rows" — documentado completo

**Corrección importante respecto a lo que había quedado de la sesión anterior**: NO son
"Row A, B, C, D, E". El array real (`TREND_ROWS`, en el módulo de trends) es:

```js
const TREND_ROWS = [
  { key:'A',    tag:'Row A · To the zone',    name:'Zone in regulation',
    describe:'Reached the Scoring Zone in regulation',
    unit:'percent', upIsGood:true, countsLabel:'of holes',
    games:['goTo'], hasReasons:true },

  { key:'B',    tag:'Row B · In the zone',    name:'Down in 3',
    describe:'Down in 3 or fewer from inside 100 yards',
    unit:'percent', upIsGood:true, countsLabel:'of holes',
    games:['chipping','wedges'], hasReasons:true },

  { key:'C',    tag:'Row C · Total strokes',  name:'Score to par',
    describe:'Strokes over or under par on logged holes',
    unit:'toPar', upIsGood:false, countsLabel:'per round',
    games:[], hasReasons:false },

  { key:'row1', tag:'Row 1 · Short putts',    name:'Short putts made',
    describe:'Putts inside 4 feet that went in',
    unit:'percent', upIsGood:true, countsLabel:'of chances',
    games:['onePutt'], hasReasons:false },

  { key:'row2', tag:'Row 2 · Total putts',    name:'Two putts or fewer',
    describe:'Holes finished in two putts or fewer',
    unit:'percent', upIsGood:true, countsLabel:'of holes',
    games:['twoPutt'], hasReasons:false },
]
```

Osea: **3 filas con letra (A, B, C) + 2 filas con número (Row 1, Row 2)** — cinco filas
en total, pero la nomenclatura mezcla letras y números a propósito (A/B/C son las filas
"grandes" del Scoring Zone y Row 1/Row 2 son las de putting, subordinadas).

### Qué mide cada fila, de dónde sale el dato

- **Row A — "To the zone" / Zone in regulation**: ¿llegaste dentro de 100 yardas (la
  Scoring Zone) en regulación? El umbral de "en regulación" se calcula como
  `par - 2` golpes (`regulationToZoneShots(par) = max(1, par-2)`), exactamente el
  concepto estándar de greens-in-regulation pero aplicado a la entrada a la Scoring
  Zone, no al green. Se registra por hoyo con un `MarkPair` (check/cross) y, si falla
  (cross), pide motivo con chips: **`ZONE_REASONS = ['Lost ball / penalty', 'Poor
  contact', 'Other']`**.
- **Row B — "In the zone" / Down in 3**: ¿bajaste en 3 golpes o menos desde adentro de
  las 100 yardas? Es el short game completo (chip/wedge + putts) desde que entrás a la
  zona hasta embocar. Si falla, pide motivo: **`HOLEOUT_REASONS = ['Poor wedge shot',
  'Poor chip', 'Poor lag putt', 'Lost ball / penalty', 'Other']`**.
- **Row C — "Total strokes" / Score to par**: simplemente golpes totales vs. par de los
  hoyos cargados. Es el resumen — `C = A (shotsToZone) + B (shotsFromZone)` por hoyo, y
  a nivel ronda es el score-to-par.
- **Row 1 — "Short putts" / Short putts made**: embocados desde adentro de 4 pies
  (default; configurable en Settings como `onePuttFeet`).
- **Row 2 — "Total putts" / Two putts or fewer**: % de hoyos resueltos en 2 putts o
  menos.

Cada fila tiene un juego de práctica asociado (`games`) que conecta con "The Combine" /
Practice: `goTo` (Go-To Club), `chipping` + `wedges` (ambos alimentan Row B), `onePutt`
(Row 1), `twoPutt` (Row 2). Row C no tiene juego propio — es el resultado derivado, no
algo que se entrena directo.

### Reasons / feedback cualitativo
Cuando Row A o Row B fallan, la app no solo cuenta el miss: pide la razón con chips
predefinidos (penalidad, mal contacto, mal chip, mal wedge, mal lag putt, u "Other" con
textarea libre). Eso se agrega en Trends (`reasonTally`) para mostrar el motivo más
frecuente de falla en cada fila — un feature de diagnóstico que golf-app no tiene.

## 3. "The Combine" — test suite de habilidad (feature nueva no documentada antes)

Hub separado del logueo de rondas: 5 tests de habilidad, cada uno con video-lección
asociada en Circle.so (`the-scoring-method.circle.so/.../the-scoring-method-combine`):

| Test (`key`) | Lección Circle.so (id) |
|---|---|
| `putts` | lesson 4635462 |
| `lag` | lesson 4635511 |
| `chip` | lesson 4635515 |
| `wedges` | lesson 4635520 |
| `driver` | lesson 4635522 |

Flujo: `Combine` (hub, lista sesiones) → `CombineIntro` (instrucciones + link a la
lección) → `CombineTest` (ejecución, con animaciones Reanimated — `pop`, `ring`, `bump`,
`roll` worklets) → `CombineTestDone` → `CombineSummary` (score card final, compartible
como imagen/PDF). Genera puntaje (`testPoints`, `goldNote`, `formatPoints`) y permite
"Card PDF" / "Combine Card" vía el mismo pipeline de PDF que el scorecard normal
(`buildCombineCard`, título del PDF: `"The Scoring Method Combine"`).

El test de driver mide dispersión lateral ("yds each side") y feeds del juego de wedges
registran `{yards, miss: result !== 'in'}` por tiro — coincide con la lógica de Wedge
Matrix / Clock System que ya tenías mapeada en `13_wedge_distance_mastery.md`.

## 4. Leaderboard (feature nueva no documentada antes)

Tabla de posiciones global, opt-in, basada en las sesiones completadas del Combine
(`isComplete`), NO en rondas de golf. Detalles:

- Backend: `${SIGNUP_URL con /signup → reemplazado por /leaderboard}` o fallback
  `/api/leaderboard`. Auth liviana por secreto random generado client-side
  (`crypto.getRandomValues`, 32 bytes, base64url) guardado en AsyncStorage —
  no hay cuenta de verdad, es un pseudo-anónimo persistente por dispositivo.
- Privacidad: el jugador puede estar oculto (`hidden`), usar nombre real o
  **nombre random generado** (`randomName`), y hay deduplicación de nombres
  (`taken`, "Someone already has X, so you're Y").
- Dos vistas: `This Month` / `All time` (`board=month|all`), con `CARD_ROWS` fijas +
  la fila propia aparte si no entra en el top.
- Rate-limit del lado servidor: maneja `429` reintentando con backoff de 20s.
- Comparte: `ShareImageButtons` para exportar el leaderboard como imagen ("TSM
  Leaderboard").
- Cada fila manda al detalle `LeaderboardPlayer` con `{id, name, rank, board, month,
  points, day}`.

Esto es puramente sobre el Combine (test de habilidad), no hay competencia por scoring
de rondas reales — probablemente a propósito, para no exponer handicaps/scores reales
de terceros sin querer.

## 5. Settings / perfil del jugador

Pantalla `Settings` expone:
- **Player**: nombre.
- **Practice targets** (presets "Level-1", `LEVEL_1_PRESETS`, con nota explícita:
  *"From the golfer's Level-1 materials. Seeded with placeholder values"*):
  - `onePuttFeet` (default 4 ft) — radio del "1-Putt Circle"
  - `twoPuttFeet` (default 30 ft) — radio del "2-Putt Circle"
  - `chippingYards` (default 5 yd) — "3-Shot Circle · Chipping"
  - `wedgesYards` (default 40 yd, step 5) — "3-Shot Zone · Wedges"
  - `goToClubYards` (default 200 yd, step 5, max 300) — "Go-To Club"
  - `goToClubFairwayYards` — ancho de fairway objetivo para el Go-To Club
- **Target scores · out of 10**: puntaje objetivo (sobre 10 intentos) por juego: short
  putts, long putts, chipping, wedges, go-to club. Estos son los "target" contra los que
  se compara cada sesión de práctica (`made >= target` = "pass").
- **Account**: email (si hay signup) + "Sign out" (aclara: *"Clears the email on this
  device. Your rounds stay"* — o sea, cuenta ≠ dato; el dato es local siempre).

Botón "Reset targets to Level-1 presets" — confirma que el producto está anclado a un
currículum por niveles del curso (Level 1, al menos) con valores semilla, no inventados
por la app.

## 6. Practice (juegos de práctica / "PP" = Prescribed Practice)

`PRACTICE_GAMES`:

| key | label | unidad medida | distancia default |
|---|---|---|---|
| `onePutt` | 1-Putt Circle | ft | `onePuttFeet` |
| `twoPutt` | 2-Putt Circle | ft | `twoPuttFeet` |
| `chipping` | 3-Shot Circle · Chipping | yd | `chippingYards` |
| `wedges` | 3-Shot Zone · Wedges | yd | `wedgesYards` |
| `goTo` | Go-To Club | yd | `goToClubYards` |

Cada juego registra sesiones de 10 intentos (`ATTEMPTS = 10`) ya sea como total
(stepper 0-10) o intento por intento (toggle ✓/✗ por bolita), compara contra
`target` (sacado del profile) y marca pass/fail. "PP" = *Prescribed Practice*: la
cantidad de reps prescriptas sale de `ppCounts` del round (cuántas veces falló cada
fila) — osea la cantidad de práctica que te "debés" depende de cuánto fallaste en la
ronda, no es fija. Confirma el copy: *"X of Y PP done"* / *"No reps prescribed"*.

## 7. Diseño / Paleta — tokens completos (ampliación de lo ya encontrado)

Objeto `theme.color` completo (antes solo se tenían 2 colores):

```js
{
  grad: ['#DCF2E7', '#CFEBDA', '#AEDDC4'],      // degradé de fondo menta (3 paradas)
  glowSun: 'rgba(255,221,130,0.92)',             // halo amarillo (sol)
  glowSky: 'rgba(150,206,255,0.95)',             // halo celeste (cielo)
  fairway: '#1c7a3f',
  fairwayMid: '#34a457',
  fairwayLite: '#77c98c',
  ink: '#15181a',                                 // texto principal
  muted: 'rgba(30,38,33,0.62)',
  faint: 'rgba(30,38,33,0.34)',
  accent: '#25b45c',                              // verde pill (acción principal)
  accentDeep: '#137a3a',
  accentSoft: 'rgba(37,180,92,0.12)',
  check: '#25b45c',
  cross: '#D8463C',                               // rojo de fallo/miss
  crossSoft: 'rgba(216,70,60,0.14)',
  gold: '#e6a915',                                // acento Combine/leaderboard
  goldText: '#c99a1c',
  goldGlow: 'rgba(255,214,90,0.95)',
  goldWash: 'rgba(255,232,140,0.7)',
  goldStar: '#f5c03a',
  glass: 'rgba(255,255,255,0.42)',
  glassStrong: 'rgba(255,255,255,0.60)',
  glassBorder: 'rgba(255,255,255,0.55)',
  specular: 'rgba(255,255,255,0.75)',
  hairline: 'rgba(40,52,45,0.16)',
  track: 'rgba(70,90,78,0.14)',
  selected: 'rgba(255,255,255,0.92)',
  shadow: '#10281a',
}
```

Notas de diseño adicionales encontradas en el HTML/CSS:
- Tipografía: **Barlow Condensed** (SIL OFL), self-hosted en woff2, pesos 700 y 800
  — solo para el lockup del título y la imagen social (og.png). El resto usa una
  stack `-apple-system, system-ui, sans-serif` (variable `sf` en el bundle).
  Confirma lo que ya se sabía: "tipografía condensada bold" es solo para branding,
  no para el UI general (que usa system font).
  - `theme-color` / `background-color` del `<html>`: `#EFE4A0` (amarillo) — distinto
    del `#DCF2E7` (menta) del manifest.json; el amarillo es el color de arranque antes
    de que cargue JS, el menta es el primer stop del degradé de fondo real.
  - "The Combine" branded share-card usa su propia paleta dorada: título `'TSM
    Combine'`, gradiente `['#e6a915','#ffd766','rgba(255,215,102,0)']`, texto oscuro
    `'rgba(30,38,33,0.5)'`, rojo de miss `'rgba(184,53,44,...)'`.
  - Glassmorphism confirmado en código: `GlassCard`, `GlassList`, `GlassButton`,
    `BlurView` (intensidad 22 fondo / 70 sheet, tint dark/light) para modales
    tipo "Jump to hole".
  - Hay cuidado específico de iOS 26 / Liquid Glass: comentario explícito en el HTML
    sobre un bug de WebKit (301108) con `black-translucent` que corta la status bar;
    por eso usan `status-bar-style: default` + `theme-color` igual al top del header.
  - No hay pinch-zoom salvo en `[data-pinch-zoom]` (el preview de la tarjeta/scorecard)
    — tratan la PWA como app nativa (sin selección de texto, sin zoom, sin callouts).

## 8. Otros features / integraciones no documentados antes

- **Sin GPS, sin clima, sin handicap/USGA**: no se encontró ninguna referencia a
  geolocalización, APIs de clima, ni cálculo de hándicap oficial en todo el bundle.
  Confirma que la app es puramente de logging manual + Scoring Method, no un GPS
  rangefinder ni un handicap tracker.
- **Scorecard PDF multi-kind**: un solo pipeline de export a PDF cubre 4 tipos de
  tarjeta (`cardLabel`): `scorecard` → "Scorecard", `practice` → "Practice Card",
  `wedge` → "Wedge Matrix", `combine` → "Combine Card" (o "Blank Combine Card" si no
  hay nombre). Todas via `ScorecardPreview` con un param `kind`.
  - Wedge Matrix PDF tiene su propio `brandStamp` y guarda como `wedge-matrix.pdf`.
- **Compartir como imagen**: `ShareImageButtons` / `ShareImageButton` reusado para
  leaderboard y combine — exporta tarjetas como imagen nativa (share sheet), no solo
  PDF.
- **Signup minimalista**: solo email, sin password, guardado local + sync best-effort
  a un endpoint serverless (`POST /api/signup {email, platform:"web"}`). Es
  completamente opcional para el funcionamiento (`signOut` aclara que las rondas se
  quedan en el dispositivo igual).
- **Edge-swipe back** (`useEdgeSwipeBack`) y manejo de teclado (`blurActiveElement` en
  cada cambio de ruta) — detalles de pulido de PWA-como-app.
- **Haptics**: `success()` / `tap()` en casi todas las acciones de guardado (confirma
  "pill button" feedback táctil mencionado en el resumen anterior).

## 9. Copy / Terminología específica del método (ampliación)

Confirmado y ampliado respecto a lo que ya se sabía ("Scoring Zone", "GIR" implícito):

- "Log a golf round in a few taps. Get The Scoring Method's cards filled in." (tagline,
  meta description y OG/Twitter card)
- "Reached the Scoring Zone in regulation" (Row A)
- "Down in 3 or fewer from inside 100 yards" (Row B) — confirma que la Scoring Zone
  oficial en esta app es **100 yardas**, no bandas separadas de 25/50/100. No se
  encontró evidencia de sub-bandas (25y/50y) como zonas distintas — es una sola zona de
  100yd con el "down in 3" como criterio de éxito adentro de ella. (Esto contradice
  parcialmente la hipótesis previa de "Five Rows = bandas GIR/25y/50y/100y": no es así,
  las filas son A/B/C + Row1/Row2 de putting, como se detalla en la sección 2.)
- "Strokes over or under par on logged holes" (Row C / Score to par)
- "Zone in regulation", "Down in 3", "Score to par", "Short putts made", "Two putts or
  fewer" — nombres oficiales de cada row.
- Reasons: "Poor wedge shot", "Poor chip", "Poor lag putt", "Lost ball / penalty",
  "Ball out of bounds", "Poor contact", "Other".
- "1-Putt Circle", "2-Putt Circle", "3-Shot Circle · Chipping", "3-Shot Zone · Wedges",
  "Go-To Club" — nombres oficiales de los 5 juegos de práctica.
  Nota la inconsistencia deliberada "Circle" vs "Zone": chipping es un círculo (toda
  dirección), wedges es una "zone" (probablemente un sector/ángulo, no 360°).
- "PP" en el copy de práctica = Prescribed Practice ("X of Y PP done").
- "The Combine" — nombre oficial del test de habilidad (putts, lag putt, chip, wedges,
  driver).
- "From the golfer's Level-1 materials. Seeded with placeholder values." — confirma
  estructura de niveles del curso (Level 1 al menos).
- Leaderboard copy: "Show me on the leaderboard", "Use a random name", "Add your name.
  Until you do, you're on the board as {random}."

## 10. Cruce contra golf-app (verificado en `prisma/schema.prisma` el 2026-10-15)

### Lo que golf-app YA cubre, y más granular que TSM Caddie
- **Sistema de 5 filas (A/B/C + Row1/Row2)**: ya existe, con otro nombre pero el mismo
  fondo. `RoundHole.strokesToEnterSz` = Row A, `RoundHole.strokesInsideSz` = Row B,
  `score` = Row C, `puttsInside1PuttCircle`/`puttDistancesFt` = Row 1/2.
  `Player.enterSzYds` / `downInSzStrokes` / `onePuttCircleFt` / `twoPuttCircleYds` son
  exactamente los targets configurables de TSM (`onePuttFeet`, `twoPuttFeet`,
  `chippingYards`, etc.), pero ya vienen en el modelo del jugador en vez de ser un
  preset fijo "Level-1".
  - **PP (Prescribed Practice) ya existe con el MISMO naming**: `PracticeTask.code`
    usa literalmente `"1"|"2"|"A"|"B"` (ver `prisma/schema.prisma:245` y
    `PracticeDrill.ppCode`) — coincide con la nomenclatura de TSM de casualidad (o
    porque ambos vienen del mismo curso de Will Robins). Los `drillType` (
    `ONE_PUTT_CIRCLE`, `TWO_PUTT_CIRCLE`, `CHIPPING`, `WEDGES_*`, `GO_TO_CLUB`) son el
    mismo set de 5 juegos de práctica de TSM, con nombres propios.
- **Shot-by-shot con GPS, keys rotas, DECADE (pinColor/dangerSide/aimedAtCenter/
  recoveryMode), mental tracking, voz**: todo esto NO existe en TSM Caddie (que confirmó
  "sin GPS, sin clima" — sección 8). golf-app es más profundo acá.

### Gap real 1 — "Reasons" de falla en Row A / Row B
TSM pide motivo con chips (`ZONE_REASONS`: Lost ball/penalty, Poor contact, Other;
`HOLEOUT_REASONS`: Poor wedge shot, Poor chip, Poor lag putt, Lost ball/penalty, Other)
cada vez que falla Row A o Row B, y lo agrega en Trends como "motivo más frecuente".
golf-app tiene `puttAnalysis` (PACE|LINE|BOTH|OTHER) pero **solo para putts** — no hay
campo equivalente para el motivo de no entrar a la SZ en regulación o de no bajar en 3.
Hoy esa causa solo queda en `holeNotes` (texto libre dictado por voz), sin estructurar
ni agregar en Trends. **Candidato a gap real**: agregar 2 campos chip-select en
`RoundHole` (`zoneReason`, `holeoutReason`) + agregación en el dashboard de trends, para
poder responder "¿por qué estoy fallando Row B este mes?" sin releer notas de voz.

### Gap real 2 — "The Combine"
No existe nada parecido: un test de habilidad standalone (5 pruebas: putts, lag, chip,
wedges, driver) con score, comparable en el tiempo e independiente del logueo de
rondas. golf-app tiene `PracticeDrill` por sesión suelta, pero no un protocolo de test
fijo con puntaje comparable round-over-round. Posible candidato a P1/P2 en el roadmap,
sin el leaderboard (no tiene sentido para una app de un solo jugador).

### Gap real 3 — PDF / imagen exportable
golf-app no tiene ningún export a PDF ni a imagen (confirmado: no hay referencias a
"pdf" en `app/` ni `lib/`). TSM tiene un pipeline único que cubre 4 tipos de tarjeta
(scorecard, practice, wedge, combine) y share-as-image para todo. Sirve si en algún
momento se quiere compartir una ronda o la wedge matrix fuera de la app (ej. mandarla
por WhatsApp a un coach) — hoy no hay forma de sacar nada de golf-app excepto mirando la
pantalla.

### No parece gap (diseño consciente de TSM, no mejor que el enfoque actual)
- Nombres random + leaderboard anónimo: solo tiene sentido en una app multi-usuario;
  golf-app es de un solo jugador (Santi), no aplica.
- Scoring Zone como banda única de 100yd (sin sub-bandas 25y/50y): golf-app en cambio
  tiene `distanceInRegYds` (distancia real al hoyo al entrar a SZ) que es más informativo
  que la banda fija de TSM — no hace falta copiar la simplificación.
