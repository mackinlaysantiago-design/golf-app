# PLAN — Shot Tracking on-course (voz + GPS + decisión/ejecución)

> Feature grande. El markdown ES el estado. Rama: `dev`. Decisión registrada en ~/mind/DECISIONS.md.

## Objetivo (criterio de éxito)
Poder registrar, **tiro a tiro y en la cancha**, cada golpe de una ronda con: distancia (GPS auto),
palo, target, **decisión (bien/mal)**, **ejecución (flush/pull/thin/…)** y **resultado** — capturado
por **nota de voz** con confirmación de 1 tap, funcionando **offline** (cola idb) y **transcribiendo en
la Mac de Santi** (Whisper local, sin gasto cloud). Y que después la app muestre **SG putting, mapa de
miss izq/der y decisión-vs-ejecución** automáticos. Éxito = una ronda cargada 100% tiro-a-tiro por voz y
el resumen mostrando esos 3 insights.

## Restricciones (de Santi)
- Transcripción con **Gemini 2.5 Flash server-side** (patrón robado de kine-bot/web/lib/gemini.ts):
  audio base64 → `generateContent` con `responseMimeType: application/json` → JSON estructurado.
  Free tier + key `GOOGLE_GENERATIVE_AI_API_KEY` que ya existe. **Sin Mac, sin gasto.** (Reemplaza el
  plan viejo de mlx-whisper local, que no servía porque Vercel no alcanza la Mac.)
- On-course, mínima fricción (voz).
- No tocar prod sin OK. Reusar lo que ya existe (GpsView, lib/geo, idb, RondaTracker).

## Tareas
- **T0 — Modelo `RoundShot` (schema)**
  - depende_de: []
  - complejidad: 3 · prioridad: alta · estado: **done** (25/07)
  - notas: modelo en schema.prisma (valida) + tabla creada en Neon (additivo, CREATE TABLE controlado, 21 cols). Relaciona a RoundHole/Round/RoundPlayer.

- **T1 — Motor GPS de tiro**
  - depende_de: [T0]
  - complejidad: 4 · prioridad: alta · estado: **in-progress**
  - notas: `src/lib/shot-gps.ts` creado y VERIFICADO — `computeShotGeo()` (dist frente/centro/fondo + largo del tiro, reusa geo.ts) y `suggestClub()` (bracket + anti-corto, tol 3yd; probado con carries reales: 187→4i, 150→7i, 125→8i, 113→PW). FALTA: cablearlo en GpsView/RondaTracker (capturar lat/lng por tiro y persistir en RoundShot).

- **T2 — Captura por voz + cola offline**
  - depende_de: [T0]
  - complejidad: 8   # ≥7 → subdividir
  - prioridad: alta · estado: backlog
  - subtareas:
    - T2.1 — **componente done (typecheck limpio)**: `rondas/[id]/shot-capture/ShotCapture.tsx` — GPS vivo
             (watchPosition) + computeShotGeo/suggestClub (F1) + MediaRecorder + POST a /api/shots/voice +
             card de confirmación (decisión/ejecución/resultado). FALTA: `page.tsx` que lo renderice con datos
             reales (roundHoleId, green del CourseMapPoint, carries) + PROBARLO EN BROWSER (mic+GPS reales, con
             dev server en un teléfono). Abierto: de dónde saca los carries la app (¿ClubDispersion? ¿RangeShot?).
    - T2.2 — Guardar audio+meta en IndexedDB (cola offline, reusar lib/offline/db) (backlog)
    - T2.3 — **done + VERIFICADO (25/07)**. `src/lib/gemini-shot.ts` (parseShotAudio, Gemini 2.5 Flash,
             inlineData, json) + route `/api/shots/voice` (multipart audio + contexto GPS → parsea → persiste
             RoundShot). Probado contra Gemini real: separa decisión/ejecución bien ("elegí bien el driver pero
             le pegué un pull" → decision GOOD + execution PULL). Key ya está en .env.production.local.
    - T2.4 — Pantalla de confirmación 1-tap (editar lo interpretado) + persistir en RoundShot (backlog)

- **T3 — Insights post-ronda**
  - depende_de: [T0, T1]
  - complejidad: 6 · prioridad: media · estado: backlog
  - notas: SG putting (ya prototipado en análisis), mapa de miss izq/der, split decisión-vs-ejecución. Pantalla de resumen.

## Decisión RESUELTA (25/07)
Transcripción = **Gemini 2.5 Flash server-side** (idea de Santi, patrón de kine-bot). Elimina la
dependencia de la Mac y el sync teléfono→Mac. Free tier + key existente. Ya no hay decisión abierta.

## Regla "qué sigue"
Menor id con deps `done` y no `done`. Ahora: **T0 (schema) en curso** → después T1.
