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



Aquí tienes la lista exhaustiva de cada drill y protocolo del Scoring Method, con sus parámetros exactos y el modelo Prisma sugerido para su digitalización en tu aplicación.

---

