# PLAN — Replanteo del flujo de datos (menos carga, mejor lectura)

> Estado: **PROPUESTA — esperando OK de Santi por sección** (26/07/2026).
> Disparador: "me cansa meter tanto dato... hay cosas que nunca hago por esa razón".
> Regla madre (ver DECISIONS.md 26/07): el teléfono en cancha es para MIRAR, no para CARGAR.

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

### P2 — DURANTE: tracker de un pulgar, lectura primero
- Por hoyo, UNA card: **distancias GPS al green (frente/centro/fondo) arriba de todo** (hoy
  están escondidas atrás del FAB 📍 en labs/maps) + quién da/recibe golpe + score con botones
  grandes + los 4 números del método. NADA más visible.
- DECADE (dangerSide/pinColor/aimedAt), gear selector, keys, recovery → detrás de un "más"
  colapsado, o directamente fuera (decidir con Santi: hoy los llena 50-65% / 12-18%).
- Leaderboard/apuestas quedan como están (es lectura y ya funciona).

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

## Tareas (a crear cuando Santi apruebe secciones)
- T1 (P2) — GPS glanceable en RondaTracker por hoyo · compl 5 · **la de más valor en cancha**
- T2 (P2) — Podar inputs por hoyo (core visible, resto colapsado/fuera) · compl 3
- T3 (P1) — Briefing lectura + termostato auto + visualización 1 tap · compl 3
- T4 (P3) — Post-ronda unificada + dictado opcional · compl 6
- T5 (P4) — Limpieza navegación · compl 2

## Preguntas abiertas para Santi
1. Durante la ronda, ¿qué querés MIRAR? (distancias GPS / apuestas y match / golpes que das-recibís
   / todo junto en una card)
2. DECADE por hoyo (lado peligro, color bandera, apuntar al centro): ¿lo dejamos colapsado o lo
   matamos? Lo venís llenando la mitad de las veces.
3. Post-ronda con nota de voz única (en casa, sin apuro): ¿va, o preferís solo chips y listo?
