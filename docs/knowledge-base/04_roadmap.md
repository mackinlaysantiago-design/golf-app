## 5. Roadmap de features (priorizado)

### P0 — fundacional (faltantes Level 1)
Estas features son la base para que el jugador pueda empezar a aplicar el método de Will Robins y ver resultados iniciales.

*   **1. Configuración Inicial del Método**
    *   **Descripción UX**: Al crear su perfil o en una sección de configuración, el usuario define sus valores personales para la Scoring Zone (SZ), Down in SZ, 1-Putt Circle y 2-Putt Circle. Esto establece sus objetivos iniciales.
    *   **Modelo de Datos**: `Player.enterSzYds`, `Player.downInSzStrokes`, `Player.onePuttCircleFt`, `Player.twoPuttCircleYds`.
    *   **Esfuerzo**: S

*   **2. Registro Detallado de Ronda (Level 1)**
    *   **Descripción UX**: Interfaz intuitiva por hoyo para registrar los golpes para entrar a la SZ, los golpes dentro de la SZ, el total de putts, los putts embocados dentro del 1-Putt Circle y los golpes de penalidad.
    *   **Modelo de Datos**: `RoundHole.strokesToEnterSz`, `RoundHole.strokesInsideSz`, `RoundHole.putts`, `RoundHole.puttsInside1PuttCircle`, `RoundHole.penaltyStrokes`.
    *   **Esfuerzo**: M

*   **3. Resumen de Ronda y Feedback Básico**
    *   **Descripción UX**: Al finalizar una ronda, la app muestra un resumen claro del rendimiento: porcentaje de éxito en "Enter SZ", "Down in SZ" y "1-Putt Circle". Ofrece un feedback simple sobre áreas de mejora.
    *   **Modelo de Datos**: Derivado de `RoundHole` data. `PracticeTask` para sugerencias.
    *   **Esfuerzo**: M

*   **4. Creación y Registro de Sesiones de Práctica (PP)**
    *   **Descripción UX**: El usuario puede crear una `PracticeSession` (fecha, notas) y añadir `PracticeDrill`s de los tipos básicos (1-Putt, 2-Putt, Chipping, Wedges, Go-To Club). Registra los intentos y resultados de cada drill.
    *   **Modelo de Datos**: `PracticeSession`, `PracticeDrill` (existente).
    *   **Esfuerzo**: M

*   **5. Drills de Práctica Guiados (Level 1)**
    *   **Descripción UX**: Para cada drill básico, la app guía al usuario con el objetivo (ej. "9 de 10 putts desde 4 pies", "8 de 10 tiros en fairway"). Permite registrar cada intento y muestra el progreso hacia el objetivo.
    *   **Modelo de Datos**: `PracticeDrill.target`, `PracticeDrill.attemptsJson`, `PracticeDrill.timesAchieved`, `PracticeDrill.leveledUp`.
    *   **Esfuerzo**: M

*   **6. Tareas de Práctica Automáticas (Homework)**
    *   **Descripción UX**: La app genera automáticamente tareas de práctica (`PracticeTask`) basadas en el rendimiento de la ronda (ej. "Practicar putts errados <4ft"). El usuario puede verlas y marcarlas como completadas.
    *   **Modelo de Datos**: `PracticeTask`.
    *   **Esfuerzo**: S

### P1 — diferencial (Level 2 + Mental + protocols)
Estas features llevarán la app a un nivel superior, implementando los conceptos avanzados y de maestría mental, diferenciándola de otras apps.

*   **1. Registro de Gears of the Game en Ronda**
    *   **Descripción UX**: Durante el registro por hoyo, el usuario puede indicar la "Gear" objetivo para el golpe de entrada a SZ (ej. "100 yds", "GIR") y para el "Down in SZ" (ej. "Down in 2 desde 125yds"), permitiendo un análisis estratégico.
    *   **Modelo de Datos**: `RoundHole.targetEnterSzGear` (nuevo), `RoundHole.targetDownInSzType` (nuevo).
    *   **Esfuerzo**: M

*   **2. Análisis Avanzado de Ronda (Gears & Keys)**
    *   **Descripción UX**: Un reporte post-ronda detallado que muestra el éxito por "Gear" y las "10 Keys to Scoring" rotas, con gráficos de dispersión y la proximidad del primer putt, ofreciendo insights profundos.
    *   **Modelo de Datos**: `RoundHole.targetEnterSzGear`, `RoundHole.targetDownInSzType`, `RoundHole.keysBroken`, `RoundHole.firstPuttDistanceFt`.
    *   **Esfuerzo**: L

*   **3. Módulo de Mental Mastery (Termostato & Visualización)**
    *   **Descripción UX**: Una sección en el perfil del jugador para definir su "Termostato de Golf" (rango de score habitual) y registrar sesiones de "Visualización de Rondas Perfectas" con el score y notas.
    *   **Modelo de Datos**: `Player.scoreThermostatMin` (nuevo), `Player.scoreThermostatMax` (nuevo), `VisualizationSession` (nuevo modelo).
    *   **Esfuerzo**: M

*   **4. Seguimiento de Creencias y Self-Talk**
    *   **Descripción UX**: Opción para registrar pensamientos o creencias (positivas/negativas) durante o después de una ronda/práctica, permitiendo al usuario identificar patrones y trabajar en su diálogo interno.
    *   **Modelo de Datos**: `MentalNote` (nuevo modelo).
    *   **Esfuerzo**: M

*   **5. Registro de Adherencia a Rutinas**
    *   **Descripción UX**: En el perfil, el jugador describe sus rutinas pre-shot y post-shot. Durante el registro por hoyo, puede calificar su adherencia a estas rutinas (ej. de 1 a 10).
    *   **Modelo de Datos**: `Player.preShotRoutineDescription` (nuevo), `Player.postShotRoutineDescription` (nuevo), `RoundHole.preShotRoutineAdherence` (nuevo), `RoundHole.postShotRoutineAdherence` (nuevo).
    *   **Esfuerzo**: M

*   **6. Drills del Chipping Protocol Guiados**
    *   **Descripción UX**: Guía paso a paso para los drills específicos del Chipping Protocol (ej. con una mano, palo delante), con instrucciones claras, registro de intentos y feedback visual sobre el progreso.
    *   **Modelo de Datos**: `PracticeDrill.drillType` (extender enum con `CHIPPING_ONE_HAND`, `CHIPPING_CLUB_FRONT`), `PracticeDrill.attemptsJson`.
    *   **Esfuerzo**: M

*   **7. Drills del 7-Day Putting Challenge Guiados**
    *   **Descripción UX**: Interfaz interactiva para los drills del 7-Day Putting Challenge (Start Line, Putting Sword, Lag Putting con estacas), con instrucciones detalladas, registro de resultados y seguimiento del progreso a lo largo del desafío.
    *   **Modelo de Datos**: `PracticeDrill.drillType` (extender enum con `PUTTING_START_LINE`, `PUTTING_SWORD`, `PUTTING_LAG_STAKES`), `PracticeDrill.attemptsJson`, `PracticeDrill.notes` o `drillDetails` (Json) para parámetros específicos.
    *   **Esfuerzo**: L

*   **8. Drill de Yardage Gapping**
    *   **Descripción UX**: Un drill específico para medir las distancias de cada palo con diferentes tipos de swing (ej. "reloj" 9, 10:30, full swing). Permite registrar múltiples tiros por club y muestra promedios y dispersión.
    *   **Modelo de Datos**: `PracticeDrill.drillType` (extender enum con `YARDAGE_GAPPING`), `PracticeDrill.club`, `PracticeDrill.swingType` (nuevo), `PracticeDrill.attemptsJson`.
    *   **Esfuerzo**: M

*   **9. Pre-Round Setup con Personal Par** *(de 10 Keys Workshop 5/6/26)*
    *   **Descripción UX**: Antes de empezar la ronda, pantalla guiada: cancha + tee + handicap + toggles de condiciones (frío, viento, sin warm-up, primera ronda año) → calcula `targetPersonalPar` y muestra `firstThreeBuffer` aceptado. El jugador asigna sus 9 hoyos de stroke (puede diferir del stroke index del course). Lista pre-cargada de stupid holes con plan tee→green.
    *   **Modelo de Datos**: nuevo `RoundPersonalPar` (coursePar, playerHandicap, strokeAllocation, conditionAdjustment, conditionFactors, targetPersonalPar, firstThreeBuffer). Extender `Player` con `goToClubOffTheTee`, `warmupPreference`, `typicalConditionRange`.
    *   **Esfuerzo**: M
    *   **Referencia**: `docs/knowledge-base/10_pre_game_routine.md` §10.1.

*   **10. Calibration Drill (Range Pre-Round)** *(de 10 Keys Workshop 5/6/26)*
    *   **Descripción UX**: Drill estructurado para usar en el range pre-round. 3 fases guiadas: (1) 3 swings sin pensar al target, (2) 10 bolas tratando de calibrar el offset detectado, (3) target practice variado nunca con el mismo club 2 veces seguidas. Output: `calibrationOffsetYards` del día, link al `Round` que sigue.
    *   **Modelo de Datos**: extender `DrillSession.drillType` con `CALIBRATION_DRILL`. Nuevos campos: `calibrationOffsetYards`, `offsetDirection`, `phase1AvgDispersion`, `phase2SuccessRate`, `clubsRotated`. Link opcional a `Round` para histórico de "cómo calibré antes de cada round".
    *   **Esfuerzo**: M
    *   **Referencia**: `05_drills_catalog.md` Drill #21.

*   **11. Wedge Matrix Tic-Tac-Toe + Full Bag Gapping** *(de 10 Keys Workshop, anticipado para "next call")*
    *   **Descripción UX**: Reemplazo / extensión del Drill #8. Interfaz de matriz 3×3 por wedge: 8 cuadrados se llenan con tiros, cuadrado central muestra average. Sistema descarta chunks/blades automáticamente del avg. Visualización: gap chart con todas las distancias del bolso (ej. L wedge 30%-45%-56%, SW 65%-75%-90%, etc.). Goal: gap ±2 yds del avg. Alimenta el club selector inteligente durante el round.
    *   **Modelo de Datos**: `DrillSession` con `WEDGE_MATRIX_TIC_TAC_TOE` y `FULL_BAG_YARDAGE_GAPPING`. Nuevos modelos `WedgeMatrixEntry` y `BagGapEntry` (ver `05_drills_catalog.md` Drills #22, #23).
    *   **Esfuerzo**: L

*   **12. Compounding & First-3 / Last-3 Detection** *(refuerzo de P1#2 desde 10 Keys Workshop)*
    *   **Descripción UX**: Post-round, la app detecta automáticamente: (a) 2+ doubles consecutivos = posible compounding; (b) score elevado en 3 hoyos siguientes a un blow-up = "holding on"; (c) breakdown de strokes en first 3 / middle 12 / last 3. Muestra prompt al jugador para reflexionar y guarda en `Round.compoundingNotes`.
    *   **Modelo de Datos**: extender `Round` con `firstThreeStrokes`, `middleTwelveStrokes`, `lastThreeStrokes`, `compoundingDetected: Boolean`, `compoundingHoles: Int[]`, `compoundingNotes: String`.
    *   **Esfuerzo**: S (lógica derivada de `RoundHole`).

*   **13. Round Assessment Card oficial digitalizado** *(de PDF oficial TSM Round Assessment Card)*
    *   **Descripción UX**: Post-round, una pantalla que replica el card oficial TSM con 11 secciones: Pre-Round Prep (4 toggles), Prep That Day (warmUp + mentalFocus), Entering SZ (counts por zona + proximity), Down in SZ (histograma 0-5), Par Breakdown, Score Breakdown (con first 3/last 3/front 9/back 9), Stats (bunkers, GS U&D, putt buckets), Best Part of Round, 5 sliders de Self Assessment %, 6 Skill Sets to Work On, Lessons Learned. Auto-fill desde `RoundHole` para todo lo derivable; campos texto/% libres para el jugador. Cálculo en vivo de "Score × Strokes Gained".
    *   **Modelo de Datos**: nuevo modelo `RoundAssessmentCard` (ver `11_round_assessment_card.md` §11.2 para schema completo). Extender `RoundHole` con `bunkerShots: Int`, `bunkerUpAndDown: Boolean`. Distance buckets se derivan de `firstPuttDistanceFt`.
    *   **Esfuerzo**: L
    *   **Prioridad**: ALTA — es el doc canónico del método, debe ser el output principal post-round.
    *   **Referencia**: `docs/knowledge-base/11_round_assessment_card.md` + `resources/round_assessment_card.pdf`.

*   **14. Drill / Test Taxonomy (Block vs Random + 5 Areas)** *(de PDF Short Game Best Drills and Tests)*
    *   **Descripción UX**: Re-categorizar cada drill existente como `DRILL` o `TEST`, asignar `shortGameArea` (5 áreas), y `practiceMode` (BLOCK/RANDOM). Mostrar al jugador su `testPassRate` por área en el dashboard. Generar PracticeTask sugerido por área débil, no aleatorio. Template "Sesión Completa" con drill→test→track de las 5 áreas.
    *   **Modelo de Datos**: enum `PracticeItemKind { DRILL, TEST }`, enum `ShortGameArea { SHORT_PUTTING, LONG_PUTTING, FRINGE_CHIPPING, PITCHING, BUNKER_PLAY }`. Extender `DrillSession` con `kind`, `shortGameArea`. Extender `PracticeSession` con `practiceMode`, `goalDescription`, `goalAchieved`. Extender `PracticeTask` con `shortGameArea`, `suggestedKind`, `suggestedDrillId`, `rationale`.
    *   **Esfuerzo**: M
    *   **Referencia**: `12_drill_test_taxonomy.md`.

*   **15. Tests del Short Game (5 áreas)** *(de PDF Short Game Best Drills and Tests)*
    *   **Descripción UX**: Implementar UI guiada para los 5 tests canónicos: 10-in-a-Row (4 ft), 50 Point Game (lag putting), 10-Hole Up-and-Down (chipping), 9-Hole Wedge Course (pitching), 10 Bunker Shots. Cada test tiene scoring system específico, target score, y registro de attempts. Output: pass/fail + delta vs target + tendencia histórica.
    *   **Modelo de Datos**: ver Drills #25, #27, #29, #30, #32 en `05_drills_catalog.md`. Cada uno tiene su modelo Prisma específico.
    *   **Esfuerzo**: L
    *   **Drills correspondientes** (drill→test pairs): #24→#25 (face control), #26→#27 (lag), #28→#29 (chipping), #22→#30 (wedge gap), #31→#32 (bunker).

### P2 — nice to have
Estas features mejoran la experiencia general y la utilidad de la app, pero no son críticas para la implementación central del método.

*   **1. Planificador de Práctica Personalizado Inteligente**
    *   **Descripción UX**: Basado en el análisis de rondas y el rendimiento en drills, la app sugiere un plan de práctica semanal o mensual dinámico, priorizando las áreas de mejora del jugador.
    *   **Modelo de Datos**: `PracticeTask` (con lógica más avanzada), `Player` (preferencias de práctica).
    *   **Esfuerzo**: L

*   **2. Integración con Calendario y Recordatorios**
    *   **Descripción UX**: Permite al usuario agendar rondas y sesiones de práctica directamente desde la app, con la opción de sincronizar con su calendario personal y recibir recordatorios.
    *   **Modelo de Datos**: `PracticeSession.date`, `Round.date`.
    *   **Esfuerzo**: S

*   **3. Compartir Resultados y Desafíos**
    *   **Descripción UX**: Opción para compartir resúmenes de rondas, logros en drills o progreso en desafíos con amigos, entrenadores o en redes sociales, fomentando la comunidad y la motivación.
    *   **Modelo de Datos**: N/A (funcionalidad de UI/API).
    *   **Esfuerzo**: M

*   **4. Historial de Progreso de Drills y Gráficos**
    *   **Descripción UX**: Visualizaciones (gráficos de línea, barras) que muestran la evolución del rendimiento del jugador en cada drill a lo largo del tiempo, destacando mejoras y tendencias.
    *   **Modelo de Datos**: `PracticeDrill` (historial de `attemptsJson`, `timesAchieved`).
    *   **Esfuerzo**: M

*   **5. Glosario Interactivo del Método**
    *   **Descripción UX**: Una sección en la app que explica los conceptos clave del método de Will Robins (Scoring Zone, Down in SZ, Gears, 10 Keys, etc.) con ejemplos y enlaces a recursos.
    *   **Modelo de Datos**: N/A (contenido estático).
    *   **Esfuerzo**: S

*   **6. Stupid Holes Manager** *(de 10 Keys Workshop 5/6/26)*
    *   **Descripción UX**: Por cancha, el jugador marca 1-3 hoyos como "stupid" y define una estrategia conservativa pre-decidida: lista de tiros con club + target + score esperado (típicamente bogey). Durante el round, al llegar al hoyo marcado, la app muestra el plan en pantalla. Post-round trackea `successRate` (% de veces que ejecutó el plan vs improvisó).
    *   **Modelo de Datos**: nuevo modelo `StupidHole` (playerId, courseId, holeNumber, strategy, shotPlan, targetScore, successRate). Unique constraint `(playerId, courseId, holeNumber)`.
    *   **Esfuerzo**: M
    *   **Referencia**: `10_pre_game_routine.md` §10.4.

*   **7. Smart Club Selector** *(habilitado por P1#11 Wedge Matrix)*
    *   **Descripción UX**: Durante el round, al ingresar la distancia restante al green, la app sugiere club + intensity basado en el `WedgeMatrix` y `BagGapMatrix` del jugador. Considera viento (input manual o API), upslope/downslope (input manual). Muestra alternativas: "GW al 95% (avg 95) o SW full (avg 95) — GW tiene menos dispersión hoy".
    *   **Modelo de Datos**: solo lógica de query; usa `WedgeMatrixEntry` + `BagGapEntry` existentes.
    *   **Esfuerzo**: M

*   **8. "Got Away With It" Tracker (Modo Avanzado)** *(de 10 Keys Workshop 5/6/26)*
    *   **Descripción UX**: Toggle en `Player.settings` que habilita el audit por hoyo (no solo en doubles). En cada hoyo de par/bogey, prompt opcional: "¿Rompiste alguna key pero zafaste?" → checkboxes de las 10 keys. Activado solo después de 10+ rondas con scoring method (la app lo desbloquea automáticamente).
    *   **Modelo de Datos**: extender `Player` con `auditModeEnabled: Boolean` (auto-true después de 10 rondas). Nuevo enum value `GOT_AWAY_WITH_IT` en `RoundHole.keysBroken`.
    *   **Esfuerzo**: S



Aquí tienes la lista exhaustiva de cada drill y protocolo del Scoring Method, con sus parámetros exactos y el modelo Prisma sugerido para su digitalización en tu aplicación.

---

