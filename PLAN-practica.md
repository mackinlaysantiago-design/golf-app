# PLAN — Revisión del sistema de práctica

> Estado: **DIAGNÓSTICO + PROPUESTA — esperando OK de Santi** (26/07/2026).
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

## Propuesta (misma filosofía que el tracker: leer mucho, cargar casi nada)
- **P1 — "Practicá esto hoy" (1 pantalla, cero setup)**: /range arranca mostrando 2-3 drills
  YA elegidos de tus debilidades de las últimas rondas, con los parámetros exactos del
  catálogo KB (distancias, goal, cuántas pelotas). Muere el wizard /setup (un solo camino).
- **P2 — Captura mínima por drill**: al TERMINAR el drill cargás UN resultado (ej. "mejor
  racha: 6" o "8/10 dentro") — una cifra por drill, no filas por intento. Niveles y récords
  se calculan igual.
- **P3 — Un solo plan, que viaje**: computePPPlan vive en UN lugar (/api/pp/plan) y el
  resumen linkea con los drills explícitos (?drills=) — lo que ves es lo que se pre-carga.
- **P4 — Limpieza**: bunker fuera del wizard hasta tener drill; tasks FLIGHTSCOPE fuera del
  loop PP; tests sin UI quedan como schema muerto (avisar, no borrar). Wedge Matrix queda
  como está (opt-in, ya construida) hasta que Santi la quiera usar.
- **P5 (opcional, después)** — UN test del método por mes como "challenge" (el del área más
  débil, ej. 50 Point Game), como medición real. Solo si P1/P2 reviven el hábito.

## Preguntas para Santi
1. ¿Va la dirección P1+P2 (plan servido + un resultado por drill)? ¿O preferís cargar
   intentos como hasta ahora y solo simplificamos la entrada (P3/P4)?
2. Cuando practicás en el range, ¿qué mirás/anotás HOY en papel o memoria? (para calibrar
   qué único número vale la pena pedirte por drill)
3. ¿El homework (PracticeTask) te sirve como concepto, o lo matamos y queda solo el
   "practicá esto hoy" derivado de las últimas rondas?
