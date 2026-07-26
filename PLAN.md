# PLAN — Shot Tracking on-course (voz + GPS + decisión/ejecución)

> **ARCHIVADO 26/07/2026** — Santi lo probó en cancha y no va: "estoy todo el tiempo con el
> teléfono en vez de disfrutando el momento". Se sacaron los FAB de entrada en RondaTracker;
> la ruta /shot-capture, el schema RoundShot, el parser Gemini y el mapa quedan vivos para
> retomar (probable pivote: dictado único post-ronda). NO seguir construyendo UX on-course.
> Reemplazado por el replanteo de flujo de datos (ver PLAN-flujo-datos.md cuando exista).

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

## v2 — mejoras pedidas por Santi (25/07, post-deploy prod)
- **V2.1 — Guardado incremental + "qué entendí" por tiro**: persistir cada tiro apenas se dicta y
  mostrar la interpretación de CADA uno en una lista viva del hoyo (v1 ya muestra la card por tiro;
  falta que quede la lista acumulada visible + confirmación/edición rápida por tiro).
- **V2.2 — Editar la ubicación del tiro en el mapa**: arrastrar/tocar el punto del tiro en el HoleMap
  (Leaflet ya existe en labs) para corregir dónde cayó → recalcula distancias/shotLength.
- **V2.3 — Carga batch multi-tiro**: al terminar el hoyo, dictar varios tiros de una ("driver al
  fairway, 7 hierro al green, dos putts") → Gemini los separa en N RoundShot; e ir marcándolos en el mapa.

## Iteración 2 — pedidos de Santi (25/07, post-deploy a prod)
- **T4** — Lista de tiros por hoyo con lo que Gemini entendió: cada tiro guardado se muestra
  acumulado (palo/decisión/ejecución/resultado + transcript) para revisar/confirmar en el momento.
  complejidad: 3 · estado: backlog. (El ShotCapture single-shot ya lo tiene por tiro; falta la lista viva.)
- **T5** — Editar la ubicación del tiro en el mapa: mapa del hoyo (reusar HoleMap/Leaflet) con marker
  arrastrable por tiro → persistir fromLat/fromLng corregidos. complejidad: 6 · estado: backlog.
- **T6** — Batch: describir varios tiros en una sola nota de voz al cerrar el hoyo → Gemini devuelve un
  ARRAY de tiros. Cambio en gemini-shot (prompt + schema array) + route (crear N RoundShot) + UI. compl: 6.
- **T7** — Marcar los tiros en el mapa a medida que se cargan (markers por tiro sobre HoleMap). compl: 5.
  depende_de: [T5].

## Iteración 3 — bugs en vivo en la cancha (25/07 tarde) — HECHA, pendiente prueba de Santi en cancha
Estado probado por Santi en producción, jugando: **marcar tiros tocando el mapa YA funciona** ✓.

- **T8 — Zoom: "Map data not yet available" a zoom alto** · estado: **done** (25/07) · compl: 3
  - Fix aplicado: `ShotsMap.tsx` ahora usa `attachSatelliteLayer()` de `mapTiles.ts` (Google z22
    nativo, fallback Mapbox→Esri). Keys `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`MAPBOX` verificadas en
    Vercel Production. VERIFICADO en prod con Playwright (screenshot: imagen Google nítida a zoom
    de green, sin cartel gris). Confirmación final de Santi en la cancha.
  - Síntoma: al acercar el satélite aparece un tile gris que dice "Map data not yet available" y no se
    ve la cancha en detalle. El fix previo (`maxNativeZoom:19`) NO alcanzó.
  - Causa raíz: ese cartel **es un tile placeholder del propio Esri World Imagery**, no es código nuestro.
    En zona rural (Villegas / La Lucila) Esri NO tiene imágenes nativas arriba de ~z17-18, así que pedir
    z19 devuelve el gris. Bajar `maxNativeZoom` no da más detalle, solo evita el cartel (upscale borroso).
  - Fix recomendado: en `src/app/rondas/[id]/shot-capture/ShotsMap.tsx:65` cambiar el tile de Esri por el
    de **Google** que YA existe en `src/app/labs/maps/[courseId]/play/mapTiles.ts:50-53`
    (`maxZoom:22, maxNativeZoom:22`) → imagen real de alta resolución en esa zona. Alternativa si se
    prefiere no depender de Google: Mapbox Satellite (también en mapTiles.ts, líneas 18-22).
  - Archivos: `ShotsMap.tsx` (SAT_URL línea 22 + tileLayer línea 65). Reusar el helper de `mapTiles.ts`.

- **T9 — Borrar tiros** · estado: **done** (25/07) · compl: 3
  - DELETE en `/api/shots/[id]` + botón 🗑️ con confirmación en dos taps (sin window.confirm) en:
    (a) chips bajo el mapa (ShotsMapPanel, cubre tiros creados por tap) y (b) lista viva de tiros
    dictados (ShotCaptureRound; ids de la DB ahora viajan en la respuesta de /api/shots/voice).
  - Si el DELETE falla (sin señal en la cancha), la UI restaura el tiro (rollback, review de Gemini).
  - VERIFICADO en prod con Playwright (flow `golf-app --flow shot-capture-smoke`): crear tiro por
    tap → chip 11 → confirmar borrado → refrescar → no reaparece; tiros reales 1-10 intactos.

## Hallazgos QA 25/07 (post-Iteración 3)
- **FIXEADO+DEPLOYADO**: los RoundShot quedaban con `roundId`/`roundPlayerId` en NULL (el cliente
  solo manda roundHoleId). Ahora las routes los resuelven server-side desde el RoundHole.
  **PENDIENTE OK de Santi**: correr `node scripts/backfill-roundshot-roundid.js` para completar
  los 10 tiros viejos (UPDATE solo de NULLs; el classifier de permisos bloqueó tocar prod DB).
- **ABIERTO — shotNumbers duplicados en el hoyo 1** de la ronda de hoy: hay dos tiros "1" y dos "2"
  (mezcla de dictado por voz —numera desde el estado local de la UI— y tap en el mapa —numera con
  max+1 de la DB—). A decidir: renumerar al vuelo o unificar la numeración por DB en ambos caminos.
- Tester Playwright: golf-app quedó configurado (`python3 ~/mind/playwright-tester/tester.py
  golf-app --flow shot-capture-smoke`). Los clicks headless sobre Leaflet son flaky (harness, no bug).
  - Pedido de Santi: poder eliminar un tiro cargado (por error o duplicado).
  - Backend: falta el método **DELETE** en `src/app/api/shots/[id]/route.ts` (hoy solo tiene PATCH).
    Agregar `export async function DELETE(...)` que borre el RoundShot por id.
  - UI: botón de borrar (🗑️) en la lista viva de tiros del hoyo (ShotCaptureRound) y/o long-press en el
    marker del mapa → confirmar → DELETE → refrescar lista + markers.

## NOTA operativa — bot en paralelo (para el Claude de la terminal)
- **Ya arreglado en `~/golf-coach/bot.py`.** La causa era que el guard anti-duplicados era FANTASMA:
  había un comentario diciendo "el flock ya se toma arriba (_BOT_LOCK_FH)" pero **el código no existía**.
  Por eso corrían 2 bots a la vez y cada mensaje disparaba 2 Claude en paralelo pisándose.
- Fix aplicado: `_acquire_single_instance_lock()` real (flock no-bloqueante en `/tmp/golf-coach-bot.lock`)
  dentro del `if __name__ == "__main__"`. Compila OK. Un watcher desatendido reinicia el bot vía launchd
  (`com.santi.golf-coach`) al terminar la sesión, para activar el candado en el proceso vivo.
- Si en la terminal ves de nuevo respuestas duplicadas: `ps -eo pid,ppid,etime,command | grep '[b]ot.py'`
  debería mostrar UN solo bot. Si hay más de uno, matá los sobrantes; el flock evita que rearranquen.
