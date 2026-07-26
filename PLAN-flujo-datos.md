# PLAN — Replanteo del flujo de datos (menos carga, mejor lectura)

> Estado: **EN EJECUCIÓN** (26/07/2026). Santi bajó línea concreta para DURANTE la ronda
> (ver "Decisiones de Santi 26/07" abajo); P1/P3/P4 siguen esperando OK.
> Disparador: "me cansa meter tanto dato... hay cosas que nunca hago por esa razón".
> Regla madre (ver DECISIONS.md 26/07): el teléfono en cancha es para MIRAR, no para CARGAR.

## Decisiones de Santi (26/07)
- **GPS/distancias NO** en la app: las mira en el reloj. (Muere T1 del plan original.)
- **Match y Medal en vivo SÍ importan** — y la tabla tiene que seguir la vuelta actual
  (en hoyo 10+ mostrar Vuelta, no quedarse en Ida). → HECHO
- **Orden por hoyo**: 1) Estrategia (DECADE — lo quiere MANTENER) → 2) golpes de todos los
  jugadores → 3) sus stats del método, que completa caminando. → HECHO
- **Golpes compactos**: un renglón por equipo, inputs chicos (no full-width), con la
  indicación de quién tiene golpe al lado del nombre. → HECHO
- **Partidos sin plata**: fuera el monto; cada modalidad/tramo vale 1 punto y el resumen
  muestra los puntos. → HECHO (wizard, editar setup y resumen)

## Audit de uso real (DB prod, 26/07 — 15 rondas, 193 hoyos propios)

### Lo que Santi SÍ sostiene (se queda, no tocar)
| Dato | Llenado |
|---|---|
| score por hoyo | 193/193 (100%) |
| putts, enter SZ, inside SZ, first putt ft, putt made ft | 185/193 (96%) |
| penaltyStrokes | 165/193 (85%) |
| Visualización pre-ronda (solo el score) | 10 sesiones / 15 rondas |
| Range: import FlightScope (OCR) + PP práctica | 3 + 4 sesiones |

### Lo que llena A VECES (candidato a simplificar o matar)
| Dato | Llenado |
|---|---|
| dangerSide / pinColor / aimedAtCenter (DECADE) | 67% / 60% / 51% |
| Reflexión: bestParts / commitment / emotionPlayed | 33% / 27% / 27% |

### Lo que NUNCA llenó (fricción pura hoy)
- **Identidad mental** (`/jugadores`: 6 textareas — creencias, rutinas, go-to club): **0**
- **MentalNote** (story/self-talk post-ronda): **0**
- **Round Assessment Card** (editor de ~18-25 taps): **0 cards en 15 rondas**
- `notes` en TODOS los modelos (ronda, range, práctica, visualización): **0**
- targetGoal (gear selector) 12% · keysBroken 18% · recoveryMode 5% · puttAnalysis/bunkers 0%
- problemArea, emotionalStateBefore, bestShot (1/15): ~0
- Sin UI o sin uso: RoundPersonalPar, StupidHole, CalibrationSession, WedgeMatrix, BagGap,
  4 tests de short game (schema muerto por ahora — avisar, no borrar)
- RoundShot (tiro-a-tiro): ARCHIVADO 26/07 (ver PLAN.md)

## Diagnóstico
El núcleo del Scoring Method (score + 4 números por hoyo) funciona y está internalizado.
Todo lo que pide TIPEAR texto o decidir entre muchas opciones tiene adopción ~0. La app hoy
pide ~20 inputs posibles por hoyo y dos pantallas de reflexión superpuestas (Reflexión del
resumen + Assessment Card) — y en cancha ni siquiera muestra las distancias GPS en el tracker
(hay que saltar al mapa de labs).

## Propuesta

### P1 — PRE-RONDA: briefing 100% lectura, cero inputs
- Termostato: dejar de pedirlo — **auto-calculado** de las últimas 10 rondas (min/max/promedio).
- Visualización: 1 solo tap ("Visualicé [score]" prefilled con el goal) o directamente opcional.
- Matar del flujo: notes de visualización, edición manual de termostato (queda en /jugadores).
- El briefing muestra: goal del día, termostato auto, dispersión por palo, recordatorio corto.

### P2 — DURANTE: tracker de un pulgar, lectura primero — HECHO 26/07 (versión Santi)
- Leaderboard sigue la vuelta actual (hoyo ≥10 → tab Vuelta automático; tabs siguen overrideables).
- Por hoyo: card "1 · Estrategia" (DECADE: peligro/bandera/centro/recovery + gear del goal) →
  card "2 · Golpes" (grilla compacta, un renglón por equipo, +N de golpe junto al nombre) →
  card "3 · Mis stats" (los 4 números SM + keys, colapsable, se completa caminando).
- GPS NO (Santi mira el reloj). Las cards gigantes por jugador se eliminaron.

### P3 — POST-RONDA: UNA pantalla, 1 minuto, con opción de dictado
- Unificar ReflexionEditor + Assessment Card en una sola pantalla post-ronda:
  commitment (slider) + 2-3 chips + **UNA nota de voz opcional** "contá la ronda" → Gemini
  llena bestParts/bestShot/emotionPlayed/story/lessons (reusa la infra archivada del
  shot-capture: gemini-shot.ts es el patrón).
- La Assessment Card oficial queda como pantalla de LECTURA auto-computada (las secciones
  C-G ya se calculan solas desde RoundHole); muere el editor de 25 taps.

### P4 — LIMPIEZA de navegación
- Esconder entradas a features nunca usadas (identidad mental completa, wedge matrix sin datos).
- Campos muertos del schema: se quedan (dead code documentado acá, no se borra).

## Tareas
- ~~T1 — GPS glanceable~~ MUERTA (Santi mira el reloj)
- T2 (P2) — Tracker reordenado + grilla golpes + leaderboard sigue vuelta · **done 26/07**
- T2b (P2) — Partidos sin plata → puntos por modalidad (wizard/setup/resumen) · **done 26/07**
- T3 (P1) — Briefing lectura + termostato auto + visualización 1 tap · compl 3 · ESPERA OK
- T4 (P3) — Post-ronda unificada + dictado opcional · compl 6 · ESPERA OK
- T5 (P4) — Limpieza navegación · compl 2 · ESPERA OK

## Preguntas abiertas para Santi
1. Post-ronda con nota de voz única (en casa, sin apuro): ¿va, o preferís solo chips y listo?
2. Del método, ¿sumamos algo a "Estrategia" como LECTURA (sin campos nuevos)? Candidatos del KB:
   Personal Par del hoyo (auto de tu historial), stupid holes (hoyos donde siempre la regalás,
   auto-detectables), go-to club off the tee. Todo calculado, cero input.
- Dead code que queda avisado: prop `money` de Field en EditarSetupModal ya no se usa;
  `RoundBet.amount/currency` quedan en el schema (amount=1 fijo, currency "PTS").
