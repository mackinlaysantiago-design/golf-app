## 11. Round Assessment Card (Oficial TSM)

Fuente: `docs/knowledge-base/resources/round_assessment_card.pdf` ("ROUND ASSESSMENT CARD" — The Scoring Method, oficial).

Es el **documento canónico post-round** que el método propone. Tiene 11 secciones que cubren preparación, ejecución, stats, mental, y reflexión. La app debería digitalizar este card en su totalidad — actualmente el schema cubre ~60% de los campos.

---

### 11.1 Estructura completa del card

#### Header (datos de la ronda)
| Campo | Tipo |
|---|---|
| `Name` | String — jugador |
| `Date` | Date |
| `Course` | String / FK Course |
| `Yardage` | Int — yds totales del tee box |
| `Par` | Int — par de la cancha desde ese tee |

#### Sección A — PRE ROUND PREPARATION (Y/N)
| Campo | Tipo | Descripción |
|---|---|---|
| `practiceRound` | Boolean | ¿Hizo practice round previo en esta cancha? |
| `yardageBook` | Boolean | ¿Tiene yardage book de la cancha? |
| `writtenPlan` | Boolean | ¿Escribió un plan de juego? |
| `personalPar` | Boolean | ¿Definió su Personal Par antes de jugar? (ver §10.1) |

#### Sección B — PREP THAT DAY (texto libre)
| Campo | Tipo | Descripción |
|---|---|---|
| `warmUp` | String | Descripción del warm-up del día |
| `mentalFocus` | String | Foco mental para el día |

#### Sección C — ENTERING THE SCORING ZONE
Diagrama de círculos concéntricos: 100Y → 50Y → 25Y → GIR. Por cada nivel se anota la **cantidad de hoyos** en los que entraste a la SZ desde esa distancia.

| Campo | Tipo |
|---|---|
| `enterSz100Y` | Int — # hoyos donde quedaste a 100Y para entrar |
| `enterSz50Y` | Int |
| `enterSz25Y` | Int |
| `enterSzGIR` | Int — # green-in-regulations |
| `x100` | Int — multiplier de fórmula (ver fórmula abajo) |
| `penalties` | Int — total de penalty strokes en la ronda |

**PROXIMITY** (distancia promedio del primer putt cuando entrás desde cada zona):
| Campo | Tipo |
|---|---|
| `proximityFromGirFt` | Float |
| `proximityFrom25YFt` | Float |
| `proximityFrom50YFt` | Float |
| `proximityFrom100YFt` | Float |

**Fórmula del card**:
```
95 - (___ × 2) = ___
95 - (GIR × 2) = Score × Strokes Gained +/-
```
El `___` se rellena con el conteo de cada zona. Da una métrica "Score × Strokes Gained" estimada vs un benchmark (95 = score esperado de un golfista promedio).

#### Sección D — DOWN IN THE SCORING ZONE
Conteo de cuántos hoyos terminaste en X strokes una vez DENTRO de la SZ. Histograma 0-5.

| Campo | Tipo |
|---|---|
| `downInSz0` | Int — # hoyos donde te tomó 0 golpes (chip-in / hole-out) |
| `downInSz1` | Int — # hoyos donde te tomó 1 golpe |
| `downInSz2` | Int |
| `downInSz3` | Int |
| `downInSz4` | Int |
| `downInSz5` | Int |
| `shotsToGetDownAvg` | Float — promedio total |

#### Sección E — PAR BREAKDOWN (avg por tipo de hoyo)
| Campo | Tipo | Descripción |
|---|---|---|
| `par5Count` | Int | # de par 5 jugados |
| `par4Count` | Int | # de par 4 jugados |
| `par3Count` | Int | # de par 3 jugados |
| `par5Avg` | Float | total shots tomados en par 5s / par5Count |
| `par4Avg` | Float | idem |
| `par3Avg` | Float | idem |

#### Sección F — SCORE BREAKDOWN
| Campo | Tipo |
|---|---|
| `score` | Int — score total |
| `eaglesCount` | Int |
| `birdiesCount` | Int |
| `parsCount` | Int |
| `bogeysCount` | Int |
| `doubleBogeysCount` | Int |
| `othersCount` | Int — triple+ |
| `firstThreeStrokes` | Int |
| `lastThreeStrokes` | Int |
| `front9Strokes` | Int |
| `back9Strokes` | Int |

#### Sección G — STATS
| Campo | Tipo |
|---|---|
| `bunkerShotsTotal` | Int |
| `bunkerShotsUpAndDown` | Int |
| `greenSideUpDownAttempts` | Int — total de greenside up-and-down attempts |
| `greenSideUpDownMade` | Int |
| `totalPutts` | Int |
| `total3Putts` | Int |

**Distance in feet** (putts por bucket):
| Bucket | Made (Int) | Attempts (Int) |
|---|---|---|
| 0-3 ft | `puttsMade0to3` | `puttsAttempts0to3` |
| 3-6 ft | `puttsMade3to6` | `puttsAttempts3to6` |
| 6-10 ft | `puttsMade6to10` | `puttsAttempts6to10` |

#### Sección H — BEST PART OF YOUR ROUND (texto libre)
| Campo | Tipo |
|---|---|
| `bestPartOfRound` | String |

#### Sección I — POST ROUND SELF ASSESSMENT (% sliders 0-100)
| Campo | Tipo | Descripción |
|---|---|---|
| `mentalStrengthPct` | Int | % de fortaleza mental |
| `positiveSelfTalkPct` | Int | % de self-talk positivo |
| `fortitudePct` | Int | % de fortitud bajo presión |
| `shotSelectionPct` | Int | % de buena selección de tiros |
| `shotExecutionPct` | Int | % de buena ejecución |

#### Sección J — SKILL SETS TO WORK ON (texto libre por área)
| Campo | Tipo |
|---|---|
| `skillUnder10Putts` | String |
| `skillLagPutts` | String |
| `skillChippingProx` | String |
| `skillWedgesProx` | String |
| `skillBallStriking` | String |
| `skillGoToClub` | String |

#### Sección K — LESSONS LEARNED (texto libre)
| Campo | Tipo |
|---|---|
| `lessonsLearned` | String |

---

### 11.2 Modelo Prisma consolidado

```prisma
model RoundAssessmentCard {
    id                       String   @id @default(uuid())
    roundId                  String   @unique
    round                    Round    @relation(fields: [roundId], references: [id])

    // Header (datos de Round, no se duplican aquí)

    // A — PRE ROUND PREPARATION
    practiceRound            Boolean  @default(false)
    yardageBook              Boolean  @default(false)
    writtenPlan              Boolean  @default(false)
    personalPar              Boolean  @default(false)

    // B — PREP THAT DAY
    warmUp                   String?
    mentalFocus              String?

    // C — ENTERING THE SCORING ZONE
    enterSz100Y              Int      @default(0)
    enterSz50Y               Int      @default(0)
    enterSz25Y               Int      @default(0)
    enterSzGIR               Int      @default(0)
    x100                     Int?
    penalties                Int      @default(0)
    proximityFromGirFt       Float?
    proximityFrom25YFt       Float?
    proximityFrom50YFt       Float?
    proximityFrom100YFt      Float?

    // D — DOWN IN THE SCORING ZONE
    downInSz0                Int      @default(0)
    downInSz1                Int      @default(0)
    downInSz2                Int      @default(0)
    downInSz3                Int      @default(0)
    downInSz4                Int      @default(0)
    downInSz5                Int      @default(0)

    // E — PAR BREAKDOWN
    par5Count                Int      @default(0)
    par4Count                Int      @default(0)
    par3Count                Int      @default(0)
    par5Avg                  Float?
    par4Avg                  Float?
    par3Avg                  Float?

    // F — SCORE BREAKDOWN
    eaglesCount              Int      @default(0)
    birdiesCount             Int      @default(0)
    parsCount                Int      @default(0)
    bogeysCount              Int      @default(0)
    doubleBogeysCount        Int      @default(0)
    othersCount              Int      @default(0)
    firstThreeStrokes        Int?
    lastThreeStrokes         Int?
    front9Strokes            Int?
    back9Strokes             Int?

    // G — STATS
    bunkerShotsTotal         Int      @default(0)
    bunkerShotsUpAndDown     Int      @default(0)
    greenSideUpDownAttempts  Int      @default(0)
    greenSideUpDownMade      Int      @default(0)
    totalPutts               Int      @default(0)
    total3Putts              Int      @default(0)
    puttsMade0to3            Int      @default(0)
    puttsAttempts0to3        Int      @default(0)
    puttsMade3to6            Int      @default(0)
    puttsAttempts3to6        Int      @default(0)
    puttsMade6to10           Int      @default(0)
    puttsAttempts6to10       Int      @default(0)

    // H — BEST PART
    bestPartOfRound          String?

    // I — SELF ASSESSMENT (0-100)
    mentalStrengthPct        Int?
    positiveSelfTalkPct      Int?
    fortitudePct             Int?
    shotSelectionPct         Int?
    shotExecutionPct         Int?

    // J — SKILL SETS TO WORK ON
    skillUnder10Putts        String?
    skillLagPutts            String?
    skillChippingProx        String?
    skillWedgesProx          String?
    skillBallStriking        String?
    skillGoToClub            String?

    // K — LESSONS LEARNED
    lessonsLearned           String?

    createdAt                DateTime @default(now())
    updatedAt                DateTime @updatedAt
}
```

---

### 11.3 Mapping al schema actual

| Sección del Card | Campo actual `Round` / `RoundHole` | Status |
|---|---|---|
| A. Pre-Round (4 booleans) | — | ❌ falta — sumar a `RoundAssessmentCard` |
| B. Prep That Day | — | ❌ falta |
| C. Entering SZ counts | `RoundHole.strokesToEnterSz` (derivable) | 🟡 derivable agregando |
| C. Proximity by zone | `RoundHole.firstPuttDistanceFt` + `targetEnterSzGear` | 🟡 derivable si tenemos gear |
| D. Down in SZ histogram | `RoundHole.strokesInsideSz` | 🟡 derivable agregando |
| E. Par breakdown | derivable de `RoundHole` | ✅ |
| F. Score breakdown | derivable | ✅ |
| F. First 3 / Last 3 | nuevo (ver §10.5) | ❌ |
| G. Stats (bunkers, GS U&D, putt buckets) | falta tracking por hoyo de bunker shots, distance buckets | ❌ falta |
| H. Best Part | — | ❌ |
| I. Self assessment % | — | ❌ |
| J. Skill sets | parcial vía `PracticeTask` | 🟡 |
| K. Lessons Learned | `Round.notes` (genérico) | 🟡 |

**Conclusión**: el schema actual cubre ~50% del card. Lo que falta:
1.  **Boolean prep flags** (4 campos) — trivial
2.  **Bunker tracking por hoyo** — agregar a `RoundHole` (`bunkerShots: Int`, `bunkerUpAndDown: Boolean`)
3.  **Putt distance buckets** — agregar a `RoundHole` (`putts0to3Distance: Int[]`, etc.) o calcular post-hoc desde `firstPuttDistanceFt`
4.  **Texto libre** (warmUp, mentalFocus, bestPart, skillsetNotes×6, lessonsLearned) — todo en `RoundAssessmentCard`
5.  **Self-assessment % (5 sliders)** — todo en `RoundAssessmentCard`

---

### 11.4 UI/UX sugerido

**Pantalla "Asesoramiento de Ronda"** post-scorecard:

1.  **Header auto-fill**: el sistema ya tiene Name / Date / Course / Yardage / Par del round.
2.  **Tabs por sección** (A-K) o un long-form scrollable.
3.  **Pre-round** (A): 4 toggles. Si el jugador ya completó Personal Par pre-round (§10.1), se auto-marca.
4.  **Stats auto-fill** (C, D, E, F, G): la app deriva todo de `RoundHole`. El jugador puede corregir.
5.  **% sliders** (I): 5 sliders de 0-100, defaults a 50 con flecha. Pedir reflexión breve si <30 o >80.
6.  **Texto libre** (B, H, J, K): cards expandibles.
7.  **Validación de fórmula** (C): mostrar el cálculo `95 - (GIR × 2) = score gained` en vivo a medida que cambia.
8.  **Save & Compare**: al guardar, comparar con últimas 5 rondas (avg de cada métrica). Highlightear deltas significativos.
9.  **Auto-derive `keysBroken`**: si el jugador escribió en `lessonsLearned` palabras como "rusheé", "agresivo", "frío", la app sugiere keys candidates (ver §06).

---

### 11.5 Fórmula "Score × Strokes Gained" del card

El card incluye una mini-fórmula:
```
95 - (GIR × 2) = Score × Strokes Gained +/-
```

Interpretación: 95 es el score esperado de un golfista promedio. Cada GIR vale ~2 strokes contra ese baseline. Si hiciste 8 GIRs:
```
95 - (8 × 2) = 95 - 16 = 79
```
Ese 79 es el "score esperado" si tu wedge play y putting fueran promedio. La diferencia con tu **score real** te dice dónde ganaste/perdiste:
-   **Score real < esperado** → ganaste strokes en wedge/putting (chips, pitches, lag putts).
-   **Score real > esperado** → perdiste strokes en short game o blow-up holes.

Es una métrica simplificada estilo "Strokes Gained" sin necesidad de PGA Tour benchmarks.

**Modelo extra** (computed):
```prisma
// en RoundAssessmentCard
expectedScore           Int?     // 95 - (enterSzGIR * 2)
strokesGainedDelta      Int?     // round.score - expectedScore
strokesGainedCategory   String?  // "GAINED" | "LOST" | "NEUTRAL"
```
