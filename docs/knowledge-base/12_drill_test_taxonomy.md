## 12. Drill / Test Taxonomy + Practice Philosophy

Fuente: `docs/knowledge-base/resources/short_game_best_drills_and_tests.pdf` ("Short Game Best Drills and Tests" — The Scoring Method).

Este doc consolida la **filosofía de práctica** del método y formaliza vocabulario que se usa transversalmente en `05_drills_catalog.md`.

---

### 12.1 Drill vs Test — distinción formal

> "Drill first. Then test the skill."

Hasta ahora el catálogo mezclaba ambos bajo el nombre "drill". El método los distingue formalmente:

| | **DRILL** | **TEST** |
|---|---|---|
| **Propósito** | Build skill | Measure skill |
| **Estructura** | Repetición | Una bola por intento |
| **Foco** | Técnica + sensación | Presión + accountability |
| **Bolas** | Múltiples bolas, muchas repeticiones | Una bola, alta expectativa |
| **Feedback** | Subjetivo / cualitativo | Numérico / objetivo |
| **Cuándo** | Primero, para construir | Después, para medir si transfiere |

**Regla de oro**: drill primero, test después. Si saltás directo a test sin drill, vas a frustrarte y fallar el test.

**En el schema**:
```prisma
enum PracticeItemKind {
    DRILL
    TEST
}

model DrillSession {
    // ... existing fields ...
    kind   PracticeItemKind  // DRILL | TEST
}
```
El schema actual usa `DrillType` enum como string opaca. Conviene categorizar cada `DrillType` con su `kind`:

| Drill # del catálogo | Kind | Nota |
|---|---|---|
| #1 (1-Putt Circle Test) | TEST | Nombre engañoso — es un test |
| #3 (10-in-a-Row from 4ft) | TEST | One-ball, pressure |
| #6 (Start Line Drill) | DRILL | Build feel |
| #7 (Putting Sword) | DRILL | Build face control |
| #8 (Green Reading) | DRILL | Build reading skill |
| #9 (Lag Putting Pace) | DRILL | Build feel |
| #11 (9 Holes Putting Test) | TEST | One-ball, 9 simulated holes |
| #12 (Chipping to 2-Putt Circle) | DRILL | Build proximity |
| #14 (Chipping 9 Holes) | TEST | Score-based |
| #15 (Wedge Proximity 30ft) | DRILL | Build accuracy |
| #16 (Wedge Yardage Gapping Clock) | DRILL | Build distance precision |
| #17 (Go-To Fairway 30yd) | DRILL | Build accuracy |
| #18 (Go-To Tight Fairway) | TEST | Tight fairway = pressure |
| #21 (Calibration Drill) | DRILL | Pre-round measurement |
| #22 (Wedge Matrix) | DRILL | Build wedge gaps |
| #23 (Full Bag Yardage Gapping) | DRILL | Build full bag |
| #24 (Putting Sword/Gate) | DRILL | Build face control |
| #25 (10-in-a-Row from 4ft) | TEST | Pressure |
| #26 (Eyes on Hole / 1-handed) | DRILL | Build feel |
| #27 (50 Point Game) | TEST | Score-based |
| #28 (Landing Zone Drill) | DRILL | Build landing control |
| #29 (10-Hole Up-and-Down) | TEST | Score-based |
| #30 (9-Hole Wedge Course) | TEST | Score-based |
| #31 (Bunker Line Drill) | DRILL | Build sand entry |
| #32 (10 Bunker Shots) | TEST | Points-based |

---

### 12.2 Block vs Random Practice

| | **BLOCK** | **RANDOM** |
|---|---|---|
| **Definición** | Repetir el mismo tiro desde la misma ubicación | Cambiar club, target, lie, situación |
| **Ejemplo** | 20 chips desde el mismo punto con el mismo wedge | 9 chips alrededor del green con clubs distintos |
| **Útil para** | Aprender una skill nueva, calibrar | Simular el campo |
| **Pitfall** | Sentís que estás bueno hasta que llegás al campo | Más difícil al principio, más transferencia |

> "Great practice sessions include both block AND random practice."

**Regla**: **block** al inicio (drill), **random** al final (test) — emula el flow del método.

**Implementación en la app**:
-   Cada `PracticeSession` puede tener metadata `practiceMode: BLOCK | RANDOM | MIXED`.
-   Auto-detectar: si todos los `DrillSession`s usan el mismo club → BLOCK; si varían → RANDOM o MIXED.
-   Sugerencia post-session: si fue 100% block, recordar "agregá un test random la próxima".

---

### 12.3 Results vs Time

> Bad practice goal: *"I practiced for an hour."*
> Good practice goal: *"I made 10 of 10 putts from 4 feet. It took me 2 attempts and about 15 minutes."*

**Regla**: la práctica se mide por **resultados, no por tiempo**.

**En el schema**:
-   `PracticeSession` tiene `goalDescription` (string) y `goalAchieved: Boolean`. NO `durationMinutes` como goal.
-   `durationMinutes` se trackea pero no es el objetivo.
-   El test (no el drill) es el que tiene `targetScore` claro.

**UI**: al crear `PracticeSession`, primer prompt: **"¿Cuál es tu goal hoy?"** (no "¿cuánto vas a practicar?").

---

### 12.4 Train Hard, Play Easy

> "Practice should be more demanding than the golf course. If you can pass tests in training, the golf course feels easier."

**Implicaciones**:
-   Tests deben tener `targetScore` agresivo (ej. 50 pts en lag putting, 24 en chipping = "rompiendo 80" benchmark).
-   El campo será **más fácil** que el test si el jugador construyó el skill.
-   Si pasás tests pero fallás en el campo → falta gestión emocional/táctica (no skill).
-   Si fallás tests pero hacés bien en el campo → suerte; el regression a la media va a doler.

**Métricas a trackear**:
-   `testPassRate` por jugador y por área (% de tests que pasaste en últimos 30 días).
-   `roundScoreDelta`: comparar score vs personal par. Si `testPassRate alto + roundScoreDelta negativo` → problema mental, no técnico.

---

### 12.5 The Five Areas of Short Game

**Para bajar tu score, tenés que entrenar las 5 áreas:**

1.  **Short Putting** — Focus: face control. Best drill: Putting Sword/Gate. Best test: 10-in-a-Row from 4ft. (Drills #24, #25)
2.  **Long Putting** — Focus: speed control. Best drills: Eyes on Hole + One-Handed. Best test: 50 Point Game (goal 50 pts). (Drills #26, #27)
3.  **Fringe Chipping** — Focus: landing zone control (2 paces onto green). Best drill: Landing Zone Drill. Best test: 10-Hole Up-and-Down (goal 24 strokes). (Drills #28, #29)
4.  **Pitching** — Focus: wedge gapping. Best drill: Wedge Matrix. Best test: 9-Hole Wedge Course (30-80 yds). (Drills #22, #30)
5.  **Bunker Play** — Focus: consistent sand strike, control entry point. Best drill: Line Drill. Best test: 10 Bunker Shots (goal 12 pts). (Drills #31, #32)

**Cada área** tiene exactamente:
-   Un **drill** principal para construir el skill.
-   Un **test** principal para medir transferencia al campo.

**Modelo Prisma**:
```prisma
enum ShortGameArea {
    SHORT_PUTTING
    LONG_PUTTING
    FRINGE_CHIPPING
    PITCHING
    BUNKER_PLAY
}

// En DrillSession
shortGameArea  ShortGameArea?
```
Categorizar cada `DrillType` por área permite:
-   Mostrar al jugador su `testPassRate` por área.
-   Sugerir drill cuando un test falla repetidamente.
-   Generar `PracticeTask` orientado a la **área más débil** (no a un drill aleatorio).

---

### 12.6 Example Practice Session (template oficial)

Sesión completa que cubre las 5 áreas, ~90-120 minutos:

| Área | Tipo | Goal |
|---|---|---|
| Short Putting | Test | Beat your personal best en 10-in-a-Row |
| Long Putting | Test | 50 puntos (50 Point Game) |
| Chipping | Test | 24 strokes o menos en 10-Hole U&D |
| Pitching | Drill | Wedge gapping con 10 bolas por wedge |
| Bunker Play | Test | 12 puntos en 10 Bunker Shots |

**What you'll need** (físico):
-   Personal practice card
-   Pencil
-   3 golf balls
-   5 tees

**Practice Structure** (canónica):
```
DRILL → TEST → TRACK RESULTS
```

**En la app**: ofrecer este template como **"Sesión de Práctica Completa"**. Auto-genera la estructura, jugador completa los outputs, sistema trackea los resultados y calcula `testPassRate`.

---

### 12.7 Aplicación al Practice Plan

El `PracticeTask` actual es genérico. Con esta taxonomía se puede mejorar:

```prisma
model PracticeTask {
    // ... existing ...
    shortGameArea     ShortGameArea?
    suggestedKind     PracticeItemKind   // DRILL or TEST
    suggestedDrillId  String?            // FK to specific drill
    rationale         String?            // "Falló 10-Hole U&D 3 veces seguidas"
}
```

**Lógica de generación automática** post-round:
1.  Si `chippingProx` malo en el card → suggest `CHIPPING_LANDING_ZONE` drill o `CHIPPING_10_HOLE_UP_AND_DOWN` test.
2.  Si `total3Putts > 3` → suggest `LONG_PUTTING_50_POINT_GAME` test.
3.  Si `bunkerShotsUpAndDown / bunkerShotsTotal < 0.3` → suggest `BUNKER_LINE_DRILL`.
4.  Si `puttsMade3to6 / puttsAttempts3to6 < 0.5` → suggest `SHORT_PUTTING_10_IN_A_ROW` (test) o `PUTTING_SWORD_GATE_DRILL` (drill, si test falla seguido).
