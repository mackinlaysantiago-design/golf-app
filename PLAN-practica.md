# PLAN — Revisión del sistema de práctica

> Estado: **EN EJECUCIÓN** (26/07/2026). Santi bajó línea: la carga por intentos NO molesta;
> lo que estaba mal era el GENERADOR del plan → ahora sigue TSM (áreas con errores → drill →
> test) y TODAS las distancias de práctica se miden en PASOS (1 paso = 3 ft = 1 yd).

## Hecho 26/07 (deploy e3fafc2)
- `src/lib/tsm-plan.ts` — `computeTsmPlan()`: señales por área desde los stats de la ronda:
  putt errado en 1PC → Short Putting · 3+ putts → Long Putting · no bajó en N desde ≤25 pasos →
  Fringe Chipping · desde >25 pasos → Pitching (drill = Wedge Matrix) · no entró a SZ → Long Game.
  Orden por errores (atacar el área más débil primero). Drill del área PRIMERO, test DESPUÉS.
- Resumen y /range/pp muestran ese plan y el botón "Practicar este plan" lleva `?drills=` →
  la sesión pre-tilda exactamente lo del plan (fix "el plan no viaja"). /api/pp/plan lo sirve.
- Drills en pasos nativos (defaults convertidos: 1-Putt arranca 1 paso, 2-Putt 10, lag 5/7/10...).
  Buckets de putts del resumen en pasos (0-1/1-2/2-3/3+).
- ppPlan legacy (A/B/1/2) quedó SOLO alimentando PracticeTask (homework sin decidir aún).
- **Unidades (corrección Santi 26/07 noche)**: los récords/datos se guardan en las unidades
  NATIVAS del método (ft/yds — benchmarks comparables: 4ft test, 6ft circle, etc.) y SOLO la
  UI muestra/ingresa pasos (helpers distToUi/uiToDist en pp-drills). Los datos de mayo quedaron
  válidos tal cual; el script de migración se eliminó (hubiera sido dañino).
- **Homework (PracticeTask)**: SE QUEDA como está — A/B/1/2 es nomenclatura del propio método
  (Purposeful Practice Card del Level 1), no legacy. El plan TSM por áreas es el desglose fino
  de esos mismos códigos (A→Long Game, B→Chipping+Pitching, 1→Short Putting, 2→Long Putting).
- Verificado en prod: ronda 11/07 → plan "Long Game 7 → test Go-To Club", resto 0; link viaja.
- Supuesto documentado: corte chip/pitch en 25 pasos (`CHIP_MAX_PASOS`); ajustable.
> Regla madre (DECISIONS.md 26/07): el teléfono es para MIRAR, no para CARGAR.
> Hermano de PLAN-flujo-datos.md (rondas). Reflexión post-ronda eliminada 26/07.

## Uso real (DB prod, 26/07)
- **Todo el sistema se usó 2 semanas y murió**: Range/FlightScope 3 sesiones (1-6/05),
  PP 4 sesiones (3-13/05) y desde entonces NADA (2,5 meses).
- Las últimas 2 sesiones PP quedaron **abandonadas a la mitad** (todos los drills 0/2, 0/4).
- PracticeTask (homework): 2 done en mayo; 2 nuevas auto-generadas pendientes.
- Wedge Matrix: 0 celdas. Tests de short game: 0 (sin UI). ClubDispersion: cargada 1 vez (9 palos).

## Qué hay construido (mapa del agente, resumen)
- Loop: resumen de ronda → computePPPlan (de tus stats) → PracticeTask + "PP Plan" → /range/pp
  (hub con niveles) → wizard /setup o directo /nueva → carga de intentos fila por fila →
  POST → niveles/récords → cierra tasks.
- FlightScope: 3 uploaders DISTINTOS que no se cruzan (sesión OCR, dispersión CSV, wedge matrix OCR).
- Del método TSM: 5 áreas y drill-vs-test están modelados; niveles/level-up andan; PERO los 4
  tests canónicos (50 Point Game, 10-Hole U&D, 9-Hole Wedge Course, 10 Bunker Shots) son
  modelos de schema SIN pantalla, el área Bunker es un callejón sin salida en el wizard
  ("próximamente"), y no existe block-vs-random ni "goal de hoy".

## Diagnóstico (por qué murió)
1. **Mismo problema que el shot-capture, pero en el range**: cargar intentos FILA POR FILA
   mientras practicás = teléfono todo el tiempo. Las sesiones 0/4 abandonadas lo gritan.
2. **El plan no viaja**: el resumen linkea a /pp/nueva sin parámetros y /nueva re-deriva "de la
   última ronda" — lo que ves en un resumen no es necesariamente lo que se pre-carga.
3. **Dos caminos de entrada** (wizard vs directo) con lógica y layout distintos + un draft
   compartido que se pisa.
4. Callejones sin salida (bunker, tests sin UI) y 3 uploaders FlightScope desconectados.
5. Mucho setup (wizard, áreas, drills, filas) para responder una pregunta simple: **"¿qué
   practico hoy y cómo me fue?"**

## Respuestas de Santi a la propuesta original (26/07)
- P1/P2 (captura mínima): NO — la carga por intentos está bien; el problema era el generador.
- P3 (plan único que viaja): SÍ → hecho (computeTsmPlan + ?drills=).
- Homework: se queda (A/B/1/2 es la Purposeful Practice Card oficial del método).

## Hecho 26/07 (2) — armar sesión en 1 tap (deploy fcd4fee)
- Pedido Santi: "es larguísimo todo el proceso de armar una sesión". Fix: MUERE el wizard
  /range/pp/setup (ruta queda como dead code, sin links); todos los "Practicar"/"+ Nueva
  sesión" van directo a /pp/nueva, que arranca con "Tu plan de hoy" (drills del plan TSM
  pre-tildados, listos para cargar) y TODO el catálogo colapsado en "➕ Agregar otro drill".
- Flujo final: abrir app → Practicar → cargar intentos → Guardar. Una pantalla.
- Verificado en prod con screenshot: 5 drills del plan visibles, "Obligatorios" viejo
  desaparecido, catálogo colapsado.

## Hecho 26/07 (3) — homework sin acumular + hub simple + pasos enteros (deploys eaa3dba/c883412)
- Homework: las PENDING reflejan SOLO la última ronda; al ver su resumen se borran las de
  rondas viejas y se sincronizan con el plan (preservando progreso). Murió el dedup "quedate
  con la más dura". Ver resumen de ronda vieja no toca nada.
- Hub PP: UN solo botón de practicar ("Practicar este plan"; si no hay plan, "Practicar");
  Challenges explicado ("mini-programas guiados de 7 días").
- Pasos SIEMPRE enteros (distToUi redondea; escalones de nivel de 2-Putt/Lag pasan de 5 a
  6 ft = 2 pasos justos). Récords con claves que colisionan al redondear se mergean.
- ACLARADO: los "PR" que Santi no reconocía SON reales — sesiones de mayo importadas de la
  planilla (1-Putt 10 seguidos a 3ft el 03/05, Wedges 5/9, Chipping 24/9). Si quiere
  arrancar de cero hay que borrarlos de la DB (pedir OK explícito).

## Backlog pendiente (sin apuro, decidir después)
- P4 limpieza: bunker fuera del wizard hasta tener drill (hoy es callejón "próximamente");
  tasks FLIGHTSCOPE fuera del loop PP; unificar los 3 uploaders FlightScope.
- P5: implementar los tests canónicos del método que hoy son schema sin UI (50 Point Game,
  10-Hole U&D, 9-Hole Wedge Course, 10 Bunker Shots) — quizás uno por mes como challenge.
- "Goal de hoy" al abrir sesión (results-vs-time, KB §12.3) y block→random como sugerencia.
