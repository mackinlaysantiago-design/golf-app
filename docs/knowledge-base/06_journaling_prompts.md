## 7. Reflexiones y Journaling

### Post-Ronda (Después de cada ronda)

Los *prompts* post-ronda buscan una evaluación objetiva del rendimiento, despojándose de la emoción inmediata para identificar patrones y áreas de mejora.

1.  **Pregunta:** "¿Tienes un problema de juego largo (full swing) o un problema de juego corto (scoring)?"
    *   **Lección:** [level-1__sec108280_les360929] "The Scoring Method" (Análisis de scorecard).
    *   **Qué busca extraer:** Una autoevaluación honesta sobre la causa principal de los *scores* altos. Robins argumenta que la mayoría cree tener un problema de *full swing*, pero los datos del *scorecard* (golpes para entrar a la SZ vs. golpes para bajar desde la SZ) suelen revelar un problema de *scoring* (juego corto y *putting*).
    *   **UI/UX:**
        *   **Tipo de campo:** Selección múltiple (Long Game / Short Game / Ambos / No estoy seguro).
        *   **Modelo de datos:** `Round.problemArea: Enum('long_game', 'short_game', 'both', 'unsure')`.

2.  **Pregunta:** "Analiza tus *3-putts* y *misses* de putts cortos (<4 pies). ¿Fue un problema de ritmo (pace) o de línea (read)?"
    *   **Lección:** [level-1__sec108280_les360927] "The Scoring Method" (Importancia del putting).
    *   **Qué busca extraer:** Diagnosticar la causa raíz de los errores en el *putting*. Si hay muchos *3-putts* pero pocos *misses* cortos, el problema es el *lag putting* (ritmo). Si se fallan muchos putts cortos, el problema es la confianza o la técnica en putts cruciales.
    *   **UI/UX:**
        *   **Tipo de campo:** Para cada *3-putt* o *miss* corto registrado, un selector (Ritmo / Línea / Ambos / Otro) y un campo de texto libre opcional.
        *   **Modelo de datos:** `Round.holes[].puttAnalysis: { type: Enum('pace', 'line', 'both', 'other'), notes: String }`.

3.  **Pregunta:** "Revisa las 'Reglas de Scoring' que rompiste. ¿Cuáles fueron y cómo contribuyeron a los golpes perdidos o *blow-up holes*?"
    *   **Lección:** [the-scoring-method-level-2__sec117049_les393066] "Level 2" (Advanced Scorecard) + [live-call-recordings__workshop_2026-05-06_10-keys-to-scoring] (10 Keys Workshop, lista explícita).
    *   **Qué busca extraer:** Identificar comportamientos de riesgo o decisiones subóptimas que llevaron a resultados negativos. Esto ayuda a construir "foresight" para futuras rondas.
    *   **Las 10 Keys to Scoring (lista completa, confirmada en el workshop 5/6/26):**
        1.  `risky_shot` — **Jugué un golpe arriesgado** (querer la bandera con poco margen, intentar un héroe shot desde mala lie).
        2.  `short_sided` — **Me dejé del lado corto del banderín** (la bola cayó del lado del green donde no hay espacio entre el banderín y el rough/bunker).
        3.  `misread_lie` — **Leí mal la lie** (no vi el grain, la pendiente, la profundidad de la rough; resultado típico: chunk o blade).
        4.  `held_bad_shot` — **Me quedé enganchado con el tiro malo** (la frustración del chunk hizo que apurara el siguiente y lo dejara corto).
        5.  `started_poorly` — **Arranqué mal** (primeros 3 hoyos en cuarta marcha sin warm-up; quemé el round antes del 4).
        6.  `underclubbed` — **No tomé suficiente palo** (especialmente en upslope donde el loft efectivo aumenta, o con viento, o en frío).
        7.  `lost_ball` — **Perdí la bola** (penalty stroke + drop).
        8.  `allowed_frustration` — **Permití que el último golpe me afectara emocionalmente** (subset de holding on, pero más amplio: cualquier carry-over emocional).
        9.  `no_commitment` — **No me comprometí con el golpe** (visualicé pero no solté, dudé entre 2 clubs y pegué el peor swing).
        10. `got_away_with_it` — **Zafé pero rompí una regla** (audit-only key: hiciste par/bogey pero jugaste un riesgo que pudo terminar mal). Marcable solo después de 10+ rondas usando el método.
    *   **Threshold de uso:**
        *   Principiante (primeras 10 rondas con scoring method): solo llenar back-of-card en hoyos de **double bogey o peor**.
        *   Avanzado (10+ rondas): auditar cada hoyo, incluyendo "got away with it" en pares y bogeys.
    *   **UI/UX:**
        *   **Tipo de campo:** Lista de *checkboxes* con las 10 keys. Para cada marcada, campo de texto opcional + sugerencia de drill relacionado (ej. risky_shot → Calibration Drill, underclubbed → Wedge Matrix).
        *   **Threshold automático**: la app oculta el back-of-card si el hoyo fue par/birdie y el jugador tiene <10 rondas. Lo muestra siempre si tiene 10+.
        *   **Modelo de datos:** `RoundHole.keysBroken: KeysBroken[]` (enum), `RoundHole.keysBrokenNotes: String`. Enum: `RISKY_SHOT | SHORT_SIDED | MISREAD_LIE | HELD_BAD_SHOT | STARTED_POORLY | UNDERCLUBBED | LOST_BALL | ALLOWED_FRUSTRATION | NO_COMMITMENT | GOT_AWAY_WITH_IT`.

4.  **Pregunta:** "Analiza la proximidad de tu primer putt. ¿Qué tan cerca dejaste la bola del hoyo en tus aproximaciones y chips? ¿Dónde necesitas mejorar para acercarla más?"
    *   **Lección:** [the-scoring-method-level-2__sec117054_les393079] "Level 2" (Proximity).
    *   **Qué busca extraer:** Determinar si los *scores* altos se deben a no acercar lo suficiente la bola con *wedges*, *chips* o *pitches*, lo que lleva a putts largos y difíciles.
    *   **UI/UX:**
        *   **Tipo de campo:** Para cada hoyo, un campo numérico para `firstPuttProximity` (distancia en pies/metros). Un campo de texto libre para la reflexión general.
        *   **Modelo de datos:** `Round.holes[].firstPuttProximity: Number (feet/meters)`. `Round.proximityAnalysis: String`.

### Post-Práctica (Después de cada sesión)

La reflexión post-práctica se centra en la efectividad del entrenamiento, la gestión de la presión y la identificación de puntos de mejora específicos para la siguiente sesión.

1.  **Pregunta:** "¿Lograste tu 'Target Score' para cada *drill*? Si no, ¿por qué? ¿Qué necesitas ajustar para la próxima vez?"
    *   **Lección:** [the-scoring-method-level-2__sec117054_les393074] "Level 2" (Advanced Practice Plans).
    *   **Qué busca extraer:** Evaluar el cumplimiento de los objetivos de entrenamiento y la capacidad de rendir bajo presión autoimpuesta. Ayuda a refinar los objetivos y la estrategia de práctica.
    *   **UI/UX:**
        *   **Tipo de campo:** Para cada *drill* realizado, un *checkbox* (Logrado / No logrado) y un campo de texto libre para observaciones.
        *   **Modelo de datos:** `PracticeSession.drills[].targetScoreAchieved: Boolean`, `PracticeSession.drills[].notes: String`.

2.  **Pregunta:** "Mientras entrenabas bajo presión, ¿cómo reaccionó tu cuerpo y tu mente? ¿Te aceleraste, te pusiste tenso, te volviste errático, o mantuviste la calma?"
    *   **Lección:** [the-scoring-method-level-2__sec117054_les393077] "Level 2" (Training Routine).
    *   **Qué busca extraer:** Identificar las respuestas fisiológicas y mentales al estrés de la práctica con propósito. Esto es clave para entender cómo se manifestará la tensión en el campo.
    *   **UI/UX:**
        *   **Tipo de campo:** Campo de texto libre. Podría complementarse con una lista de *checkboxes* de síntomas comunes (Aceleración, Tensión, Jerky, Desaceleración, etc.).
        *   **Modelo de datos:** `PracticeSession.pressurePerformanceNotes: String`, `PracticeSession.symptoms: Array<Enum(...)>`.

3.  **Pregunta:** "¿Qué debilidad específica de tu ronda anterior abordaste en esta sesión? ¿Sientes que mejoraste en esa área?"
    *   **Lección:** [the-scoring-method-level-2__sec117054_les393091] "Level 2" (Webinar/Q&A).
    *   **Qué busca extraer:** Conectar directamente la práctica con el rendimiento en el campo, asegurando que el entrenamiento sea relevante y dirigido a problemas reales.
    *   **UI/UX:**
        *   **Tipo de campo:** Campo de texto libre para describir la debilidad y la mejora percibida.
        *   **Modelo de datos:** `PracticeSession.specificWeaknessAddressed: String`, `PracticeSession.perceivedImprovement: Boolean`.

### Pre-Ronda / Pre-Tiro (Rutinas Mentales)

Estos *prompts* se utilizan para preparar la mente antes de una ronda o un golpe, enfocándose en el control interno y la visualización.

1.  **Pregunta (Pre-ronda):** "En tu mente, ¿cuál es el rango de *score* que siempre haces? ¿Qué *score* deseas lograr hoy? Visualiza una ronda perfecta con ese *score*."
    *   **Lección:** [the-scoring-method-level-2__sec117056_les393095] "Level 2" (Mental Self Image - Golfing Thermostat), [the-scoring-method-level-2__sec117056_les393096] (Visualización de rondas).
    *   **Qué busca extraer:** Desafiar el "termostato de golf" (creencia limitante sobre el *score* habitual) y reprogramar la mente subconsciente hacia un objetivo más alto a través de la visualización.
    *   **UI/UX:**
        *   **Tipo de campo:** Campo numérico para `desiredScore`. Campo de texto libre para describir la visualización.
        *   **Modelo de datos:** `Round.desiredScore: Number`, `Round.preRoundVisualization: String`.

2.  **Pregunta (Pre-ronda):** "¿Qué emociones sientes normalmente antes de jugar? ¿Qué emociones sientes cuando juegas tu mejor golf? ¿Cómo puedes cultivar esas emociones hoy?"
    *   **Lección:** [level-1__sec107601_les360918] "The Scoring Method" (Golfing Mindset - Emocional, no mental).
    *   **Qué busca extraer:** Conciencia emocional y estrategia para entrar en un estado emocional óptimo para el juego.
    *   **UI/UX:**
        *   **Tipo de campo:** Lista de *checkboxes* para emociones comunes (Nervioso, Ansioso, Confiado, Relajado, etc.) y un campo de texto libre para la estrategia.
        *   **Modelo de datos:** `Round.emotionalStateBefore: Array<Enum(...)>`, `Round.emotionalStrategy: String`.

3.  **Pregunta (Pre-tiro):** "¿Qué puedes controlar en este golpe (interno) y qué no puedes controlar (externo)?"
    *   **Lección:** [level-1__sec107601_les360918] "The Scoring Method" (Controlar lo interno).
    *   **Qué busca extraer:** Un *check-in* mental rápido para enfocar la energía en lo que el jugador puede influir (respiración, visualización, compromiso) y soltar lo que no (resultado del golpe, viento, etc.).
    *   **UI/UX:**
        *   **Tipo de campo:** Este es más una pregunta interna. En la app, podría ser un *pop-up* o un recordatorio visual antes de registrar un golpe, con *checkboxes* para "Me enfoqué en mi respiración", "Visualicé el golpe", "Me comprometí al 100%".
        *   **Modelo de datos:** `Shot.preShotMentalCheck: { focusedBreathing: Boolean, visualizedShot: Boolean, committed: Boolean }`.

4.  **Pregunta (Pre-tiro):** "Mi objetivo para esta mitad del hoyo es: [Entrar a la Scoring Zone / Bajar en la Scoring Zone]. ¿Puedo obtener un 'Check'?"
    *   **Lección:** [level-1__sec108280_les360935] "The Scoring Method" (Checks y X's).
    *   **Qué busca extraer:** Simplificar el objetivo del golpe actual, reduciendo la presión de un *score* total y enfocándose en un objetivo manejable.
    *   **UI/UX:**
        *   **Tipo de campo:** Un selector para la fase del hoyo (Enter SZ / Down in SZ) y un *checkbox* para "Obtener Check". Esto se integraría en la interfaz de registro de golpes.
        *   **Modelo de datos:** `Hole.currentPhase: Enum('enter_sz', 'down_in_sz')`, `Hole.checkAchieved: Boolean`.

### Periódico (Semanal/Mensual)

Estos *prompts* invitan a una reflexión más profunda sobre el progreso a largo plazo, la identidad como golfista y las creencias subyacentes.

1.  **Pregunta:** "¿Cuál es la 'historia' que te cuentas a ti mismo sobre tu juego de golf (tus creencias limitantes)? ¿Cuál es la historia opuesta que te gustaría contar?"
    *   **Lección:** [mental-mastery__sec227643_les840378] "Mental Mastery" (Historias que nos contamos).
    *   **Qué busca extraer:** Identificar y desafiar las narrativas internas negativas que impiden el progreso, y reemplazarlas con creencias empoderadoras.
    *   **UI/UX:**
        *   **Tipo de campo:** Dos campos de texto libre: "Mi historia actual" y "Mi nueva historia".
        *   **Modelo de datos:** `User.limitingBeliefs: String`, `User.empoweringBeliefs: String`.

2.  **Pregunta:** "¿Quién es un golfista que admiras? ¿Qué 'es' (Be), 'hace' (Do) y 'tiene' (Have) ese golfista? ¿Cómo puedes empezar a 'ser' ese golfista?"
    *   **Lección:** [mental-mastery__sec227643_les840379] "Mental Mastery" (Be Do Have).
    *   **Qué busca extraer:** Fomentar la modelación de roles y la visualización de la identidad deseada, entendiendo que el "ser" precede al "hacer" y al "tener".
    *   **UI/UX:**
        *   **Tipo de campo:** Campo de texto para "Golfista admirado". Tres campos de texto libre para "Be", "Do", "Have". Un campo de texto libre para "Cómo empezar a ser".
        *   **Modelo de datos:** `User.admiredGolfer: String`, `User.admiredGolferBe: String`, `User.admiredGolferDo: String`, `User.admiredGolferHave: String`, `User.howToEmbody: String`.

3.  **Pregunta:** "Revisa tus datos de *scorecard* y práctica de las últimas semanas/meses. ¿Qué patrones emergieron? ¿Qué áreas requieren tu atención más urgente para el próximo período de entrenamiento?"
    *   **Lección:** [level-1__sec108298_les360921] "The Scoring Method" (Purposeful Practice Card), [the-scoring-method-level-2__sec117049_les393066] (Advanced Scorecard).
    *   **Qué busca extraer:** Una visión holística del progreso y las tendencias, utilizando los datos recopilados para informar la planificación del entrenamiento futuro.
    *   **UI/UX:**
        *   **Tipo de campo:** Campo de texto libre para el análisis de patrones y la planificación.
        *   **Modelo de datos:** `User.periodicReview: String`.

---

### Propuesta de Estructura UI/UX y Modelo de Datos Adicional

**General para Journaling:**

*   **Interfaz:** Una sección dedicada a "Mi Diario" o "Reflexiones" accesible desde el menú principal. Dentro, pestañas para "Post-Ronda", "Post-Práctica", "Pre-Ronda", "Periódico".
*   **Visualización:** Los *prompts* podrían presentarse como tarjetas interactivas. Al completar, se guardan con fecha y hora. Historial de entradas para revisar el progreso.
*   **Integración:** En la pantalla de finalización de ronda/práctica, se ofrecerían automáticamente los *prompts* relevantes.

**Modelo de Datos Adicional:**

*   **`User` (o `Profile`)**
    *   `golfingThermostatRange: String` (ej. "83-89")
    *   `limitingBeliefs: String`
    *   `empoweringBeliefs: String`
    *   `admiredGolfer: String`
    *   `admiredGolferBe: String`
    *   `admiredGolferDo: String`
    *   `admiredGolferHave: String`
    *   `howToEmbody: String`
    *   `periodicReview: String`
*   **`Round`**
    *   `problemArea: Enum('long_game', 'short_game', 'both', 'unsure')`
    *   `emotionalStateBefore: Array<Enum('nervous', 'anxious', 'confident', 'relaxed', ...)>`
    *   `emotionalStrategy: String`
    *   `keysBroken: Array<Enum('risky_shot', 'underclubbed', 'lost_ball', 'no_commitment', ...)>`
    *   `keysBrokenNotes: String`
    *   `firstPuttProximity: { holeNumber: Number, distance: Number }[]` (Array de objetos para cada hoyo)
    *   `proximityAnalysis: String`
    *   `desiredScore: Number`
    *   `preRoundVisualization: String`
*   **`PracticeSession`**
    *   `drills: { drillName: String, targetScoreAchieved: Boolean, notes: String }[]`
    *   `pressurePerformanceNotes: String`
    *   `symptoms: Array<Enum('acceleration', 'tension', 'jerky', 'deceleration', ...)>`
    *   `specificWeaknessAddressed: String`
    *   `perceivedImprovement: Boolean`
*   **`Shot` (dentro de `Round` o `PracticeSession` si se registra a nivel de golpe)**
    *   `preShotMentalCheck: { focusedBreathing: Boolean, visualizedShot: Boolean, committed: Boolean }`
*   **`Hole` (dentro de `Round`)**
    *   `currentPhase: Enum('enter_sz', 'down_in_sz')`
    *   `checkAchieved: Boolean`
    *   `puttAnalysis: { type: Enum('pace', 'line', 'both', 'other'), notes: String }`

Esta estructura permite capturar tanto datos cuantitativos como reflexiones cualitativas, alineándose con la filosofía de Will Robins de usar datos para informar la emoción y la estrategia.

