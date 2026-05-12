## 10. Pre-Game Routine y Warm-Up

Fuente principal: **10 Keys to Scoring Workshop (5/6/26)** — Live Call Recordings, Coach Will Robins.
Lecciones complementarias: `[level-1__sec107601_les360918]` (Golfing Mindset), `[the-scoring-method-level-2__sec117056_les393095]` (Mental Self Image / Termostato).

> "Tu golf es emocional, no mental. Es balancear emociones, no pensamientos. Podés tener todos los pensamientos positivos del mundo y aun así jugar pésimo."
> — Will Robins

---

### 10.1 Filosofía: Personal Par

El **Personal Par** es el target de score que vos te ponés para hoy, basado en tu handicap y las condiciones del día. No es el par de la cancha, es el par tuyo. Reduce tensión, evita la agresividad innecesaria y prepara mentalmente para los primeros 3 hoyos (zona crítica).

**Principios:**

1.  **Match-play mindset siempre**: el objetivo es ganarle a tu handicap por 1 stroke. No "shoot 79", no "break 80". Solo "beat my handicap by 1".
2.  **Elegí TUS hoyos de stroke**: no confíes ciegamente en el `stroke index` del scorecard. Las canchas a veces lo asignan mal (ej. par 5 más fácil con stroke index 8, par 3 de 220 yds con stroke index 18). Vos decidís en qué 9 hoyos vas a usar tus strokes.
3.  **Ajustá por condiciones**: frío, viento ≥30 km/h, sin warm-up, primera ronda del año → tu personal par sube. US Open mindset: "even par gana el torneo".
4.  **Throw-in strokes**: incluso siendo handicap 9, está OK arrancar `bogey, bogey, bogey` o `bogey, double bogey, bogey`. La tensión baja, el resto del round mejora.

**Componentes del Personal Par:**

| Componente | Descripción |
|---|---|
| `coursePar` | Par oficial de la cancha desde tu tee box |
| `playerHandicap` | Handicap actual del jugador |
| `strokeAllocation` | Lista de hoyos donde el jugador asigna sus strokes (no el stroke index del course) |
| `conditionAdjustment` | Strokes extra por condiciones (cold, wind, no_warmup, first_round, etc.) |
| `targetPersonalPar` | `coursePar + handicap + conditionAdjustment` |
| `firstThreeBuffer` | Bogey/double aceptado en primeros 3 hoyos |

**Modelo Prisma sugerido:**

```prisma
model RoundPersonalPar {
    id                   String  @id @default(uuid())
    roundId              String  @unique
    round                Round   @relation(fields: [roundId], references: [id])
    coursePar            Int
    playerHandicap       Float
    strokeAllocation     Json    // [{ holeNumber: 1, strokesAllocated: 1 }, ...]
    conditionAdjustment  Int     @default(0)
    conditionFactors     Json?   // ["cold", "wind", "no_warmup"]
    targetPersonalPar    Int
    firstThreeBuffer     Int     @default(0) // strokes "regalados" en primeros 3
    notes                String?
}
```

---

### 10.2 Warm-Up — 3 escenarios

Will identifica 3 modos según el tiempo disponible. Cada uno requiere un mindset diferente, no solo un volumen distinto de bolas.

#### A) Sin warm-up (5 minutos o menos)

Llegaste al tee, no calentaste. Lo más común cuando vas a jugar con familia/amigos después del trabajo.

**Mindset:** "El cuerpo está frío, no sé qué va a pasar con la bola. Voy a mantenerla en juego con mi go-to club."

**Acciones:**
1.  **Bajar de marcha**: si tu velocidad de swing normal es 120 mph, hoy es 105. Conscientemente.
2.  **Go-to club off the tee**: el palo más recto del bolso. Para Will es 2-iron; para vos puede ser híbrido, 5-fierro o driver si lo pegás derecho. **Nunca driver si no es tu palo más recto.**
3.  **Expectativa**: bogey o doble en hoyo 1. Aceptado de antemano.
4.  **Resetear personal par**: sumar 2-3 strokes al target del día.

#### B) Warm-up corto (15-30 minutos)

**Fase 1 — Cuerpo (5 min):** estiramiento, swings al aire, 5 wedges al 50% para activar.

**Fase 2 — Calibración (10-15 min):** 15-20 bolas para encontrar el patrón de hoy (ver §10.3).

**Fase 3 — Target practice (5-10 min):** simular el front 9 mentalmente, nunca 2 clubs iguales seguidos.

#### C) Warm-up completo (45-90 minutos) — Will Robins style

> "Yo soy normalmente 60-90 minutos, guys."

**Fase 1 — Cuerpo:** 5-10 min estiramiento + activación.

**Fase 2 — Wedges + chips + putts (15 min):** target orientated, no técnica. Pace + sensación. Si no hay tiempo después de chipping, **putts y chips siempre antes que range**.

**Fase 3 — Range con calibración (15-20 min):** ver §10.3.

**Fase 4 — Hogan-style mental walk-through (10-15 min):** jugá mentalmente los 9 hoyos del front + todos los par 3. Por cada hoyo: visualizá el tee shot, calculá el segundo, imaginá el green. Nunca 2 mismos clubs seguidos en el range — el campo no funciona así.

**Fase 5 — Putts antes de salir (5-10 min):** lag putts (15-30 ft) + 4-footers para la confianza del 1-Putt Circle.

---

### 10.3 Calibration en el Range

El concepto central: **no estás "trabajando el swing", estás midiendo qué hace tu cuerpo HOY.** Los misses son data, no un fracaso.

**Protocolo de Calibration Drill** (detallado en `05_drills_catalog.md` Drill #21):

1.  **Setup**: alignment stick apuntando al objetivo (ej. cartel 150 yds), bola justo detrás del stick. **Importante: alineás la bola al target, NO los pies.** Los pies pueden estar "naturales".
2.  **Por qué club face, no pies**: la cara del palo determina dónde va la bola, no los pies. Si tirás siempre a la izquierda, no movés los pies — apuntás más a la derecha y dejás que el cuerpo encuentre la respuesta.
3.  **Test #1 (3 swings, sin pensar)**: tirá 3 bolas tratando de pegar derecho al target. Sin trabajar técnica.
    -   Si las 3 caen a ±2 yds del target → estás calibrado. Pasá a target practice.
    -   Si las 3 caen 30 yds left → hoy estás calibrado 30 yds left.
4.  **Test #2 (10 bolas, "30 yds right")**: pickeá un target y deliberadamente tratá de pegar 30 yds a la DERECHA.
    -   Lo que tu cuerpo necesita "sentir" para hacerlo, va a ser tu swing recto del día.
    -   Resultado típico: la bola va al target o cerca. "Si fuera right, iría right. No fue right, fue al medio."
5.  **Test #3 (target practice variado)**: empezás a tirar a distintos targets con distintos clubs. Nunca el mismo club 2 veces seguidas. Driver al árbol → 4-iron a la bandera → wedge 55 yds.

**Por qué nunca 2 clubs iguales seguidos**: el campo nunca te da eso. Si en el range pegaste 50 drivers, el primer driver del campo se siente normal. Pero después tenés que pegar un 7-iron al green, después un wedge desde el bunker, después un híbrido del tee. Si entrenaste en bloque, no pudiste calibrar la transición.

**Métrica del día**: tu `calibrationOffsetYards` (cuántos yds de offset tuviste hoy para calibrar). Si lo trackeás semanas, vas a ver patrones (ej. los lunes tirás 10 yds left; con frío, 20 yds right; antes de torneo, alineas mejor).

---

### 10.4 Stupid Holes — Bake-in-the-Bogey

Toda cancha tiene 1-3 hoyos "tontos": diseño raro, dogleg imposible, árbol gigante en el medio del fairway, agua en los dos lados, par 4 que es realmente par 5. Vos no vas a cambiar el hoyo. Tenés 2 opciones: protestar cada round o **diseñar una estrategia de putter-putter-putter que te dé bogey 9 de 10 veces**.

**Reglas de Stupid Hole:**

1.  **Definí los hoyos "stupid" de tus canchas habituales**. Un jugador puede tener 1-3 por cancha.
2.  **Estrategia conservativa pre-decidida**: NO salís al tee a "ver qué onda". Ya sabés qué club, qué línea, qué segundo tiro. Ejemplo del workshop:
    -   Hoyo 11 de Will (560 yds uphill, doble dogleg): 4-iron tee, 4-iron layup, 6-iron al área green, chip + putt = bogey 9 de 10 veces.
    -   Hoyo 18 de Claudia (par 4 corto, árbol bloqueante): 7-iron al fairway, 7-iron pasando el árbol, wedge al green, 2 putts = bogey aceptado.
3.  **Bogey > 9**: el peor enemigo en stupid holes es el doble/triple por meterte donde no podés salir. Bogey es un éxito. 7+ es un desastre.
4.  **No ajustes la estrategia mid-round**: si decidiste "putter putter putter", ejecutalo. La tentación de pegar el héroe shot es lo que te lleva al 8.

**Modelo Prisma sugerido:**

```prisma
model StupidHole {
    id                  String  @id @default(uuid())
    playerId            String
    courseId            String
    holeNumber          Int
    strategy            String  // "putter putter putter"
    shotPlan            Json    // [{ shotNum: 1, club: "7-iron", target: "fairway center" }, ...]
    targetScore         Int     // bogey usually
    successRate         Float?  // % of times you executed the plan
    notes               String?

    player              Player  @relation(fields: [playerId], references: [id])
    course              Course  @relation(fields: [courseId], references: [id])
    @@unique([playerId, courseId, holeNumber])
}
```

---

### 10.5 First 3 / Last 3 Holes

Donde se ganan y pierden los rounds. Ya está en `04_roadmap.md` como parte del Advanced Round Review, pero el workshop refuerza el por qué:

-   **Primeros 3 hoyos**: si arrancás "en cuarta marcha" tratando de hacer par, hay buenas chances de empezar `7-7-6` y que el resto del round sea recuperación. Mejor `bogey-bogey-bogey` (incluso sin warm-up).
-   **Últimos 3 hoyos**: viene la presión del score. Si ibas bien, te ponés conservador y la tensión sube. La rutina pre-shot se acelera. El compromiso baja.

Cada round trackeable debería tener un mini-report:

```
First 3:    bogey, bogey, bogey   (+3 vs personal par)  → OK arranque controlado
Middle 12:  +2                     → buen ritmo
Last 3:     par, par, double       → último hoyo problema (stupid hole?)
```

**Modelo Prisma sugerido (extender Round):**

```prisma
// Round
firstThreeStrokes      Int?
middleTwelveStrokes    Int?
lastThreeStrokes       Int?
firstThreeNotes        String?
lastThreeNotes         String?
```

---

### 10.6 Compounding & Holding On

> "La diferencia entre 71 y 81 es la paciencia. No permitir que un mal hoyo arrastre los siguientes."
> — Will Robins (sobre Rod, que hizo doble en 13 y después par-birdie-par-par)

**Compounding** = un mal hoyo lleva al siguiente. **Holding on to the bad shot** = el chunk de tu chip te hace apurar el siguiente y dejarlo a 17 ft.

**Detección automática**: la app puede flaggar:
-   2 doubles consecutivos → "Posible compounding"
-   3+ holes después de un blow-up donde el score sube vs personal par → "Holding on"

**UI/UX sugerido**: post-round, si se detecta compounding, mostrar:
> "En el hoyo 13 hiciste doble. En el 14 hiciste otro. Después volviste al ritmo. Pregunta: ¿llevaste la frustración del 13 al 14, o fue independiente?"

Y guardar la respuesta en `Round.compoundingNotes`.

---

### 10.7 Aplicación al Player Profile

El Personal Par + Stupid Holes + Go-To Club son configuración del jugador, no del round. Sugerencia para `Player`:

```prisma
// Player
goToClubOffTheTee      String?  // "2-iron", "4-hybrid", "driver"
goToClubReason         String?  // "Mi palo más recto. Lo uso cuando no calenté."
warmupPreference       String?  // "60-90min", "30min", "none-acceptable"
typicalConditionRange  Json?    // [{ factor: "cold", strokesAdded: 2 }, ...]
```

---

### 10.8 Resumen UI/UX

**Pantalla pre-round (nueva):**

1.  Selector de cancha + tee box → muestra `coursePar`.
2.  Auto-fill `playerHandicap`.
3.  Toggles de condiciones: 🥶 frío | 💨 viento | ⚠️ sin warm-up | 🆕 primera ronda año.
4.  Calculadora muestra `targetPersonalPar` y `firstThreeBuffer`.
5.  Lista de stupid holes de esta cancha (si los hay) con la estrategia pre-cargada.
6.  Botón "Confirmar Personal Par" → guarda `RoundPersonalPar` y abre el scorecard.

**Pantalla pre-shot (extensión existente):**

-   Si el hoyo está marcado como `stupid`, mostrar el `shotPlan` arriba del scorecard ("Hoyo 18: putter→putter→putter, target=bogey").

**Post-round:**

-   `actualScore vs targetPersonalPar` (no vs course par).
-   First 3 / Last 3 breakdown.
-   Detección automática de compounding.
-   Sticky reminder: "¿Updateás tu lista de stupid holes? ¿Qué pasó en el 18?"

---

### 10.9 Referencia rápida (cheat sheet)

| Situación | Mindset | Acción |
|---|---|---|
| Sin warm-up | "Frío, no sé qué va a pasar" | Go-to club, bajar marcha, +2-3 strokes al personal par |
| Frío extremo | "US Open mindset, even par gana" | +3-5 strokes, primeros 3 son bogey-aceptado |
| Stupid hole | "Putter putter putter, bogey > 9" | Plan pre-decidido, ejecutar sin variar |
| Doble en hoyo X | "No compounding, próximo es independiente" | Reset emocional pre-shot del siguiente |
| Pegué bien la primera | "OK, una shot is one shot" | Mismo plan, no inflar expectativas |
| Range pre-round | "Calibrá, no entrenes técnica" | 3 swings sin pensar → 30-yds-right test → target practice |
