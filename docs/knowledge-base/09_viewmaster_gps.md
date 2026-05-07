# ViewMaster GPS de Golfistics — research

## Qué es

Web app móvil dentro del ecosistema **Golfistics** (Hallmore Argentina SRL).
URL directa: `https://www.hallmore.com/golf/viewmaster_canchascercanas.php`

Dos pantallas:
1. **Selector**: pide GPS, lista canchas cercanas, login con matrícula o invitado
2. **Visor de hoyo**: "Hoyo N" + flechas ←/→ + 3 distancias al green
   (FONDO / CENTRO / FRENTE) + botón "VER GREEN" + "VOLVER AL SCORE"

## Cómo obtienen los mapas (inferencia)

**NO usan tiles satelitales tipo Garmin**. La arquitectura sugiere:
- Por cancha tienen guardadas en DB las coordenadas GPS de **3 puntos del
  green** (frente / centro / fondo)
- "Mapa" probablemente es **imagen estática del hoyo** (foto aérea del club)
  + overlay JS calculando distancia desde GPS del usuario
- No hay bunkers/agua mapeados ni shot tracking
- Por eso solo cubren clubes que pagan Golfistics — cada cliente sube sus coords

## API / Integración

**No hay API pública**. Hallmore vende SaaS por club, no se integra con terceros.
- Los datos de course rating/slope sí están en AAG (no tiles)
- Para coordenadas: scrape de Google Maps satellite o cargarlas a mano

## Features replicables (MVP simple)

1. **3 distancias al green (frente / centro / fondo)** — 80% del valor con
   esfuerzo mínimo
2. **Canchas cercanas por GPS** — auto-detección
3. **Modo invitado / sin login** — captura rápida
4. **Integración scorecard ↔ GPS** — botón "Volver al Score"
5. **Web app, no native** — un solo Next.js sirve iOS + Android

## Plan MVP para nuestra app (~3-4 hs)

### Schema
```prisma
model CourseHole {
  ...
  greenFrontLat   Float?
  greenFrontLng   Float?
  greenCenterLat  Float?
  greenCenterLng  Float?
  greenBackLat    Float?
  greenBackLng    Float?
  // Opcional: tee box coordenadas para "te quedan X yds desde el tee"
  teeLat          Float?
  teeLng          Float?
}
```

### UI flow
1. **Editor de cancha** (`/jugadores/canchas/[id]`): pegar coordenadas de los 3
   puntos del green por hoyo (copiando de Google Maps satellite). 18 hoyos × 3
   puntos = 54 entradas. Una vez por cancha. ~30 min.
2. **Tracker en cancha**: nuevo botón "📍 GPS" que abre panel:
   - Pide permission GPS
   - Calcula con haversine las distancias del jugador a los 3 puntos
   - Muestra `Frente 145y · Centro 152y · Fondo 159y`
3. **Cargar coordenadas iniciales**: para Lucila + Pilar + Olivos + Jockey
   (4-5 canchas que más jugás), pegás manualmente. Las otras quedan sin GPS.

### Sacrificio vs Garmin/Hole19
- No mapa visual del hoyo (solo números de distancia)
- No bunkers/agua marcados
- Pero es funcional para "cuánto me queda al green" en cancha

## URLs clave

- http://www.hallmoreargentina.com/golfistics
- https://www.hallmore.com/golf/viewmaster_canchascercanas.php
- https://golfistics.hallmoreapps.com/
- https://apps.apple.com/ar/app/golfistics/id1167654856
- AAG canchas: https://www.aag.org.ar/canchas/directorio-de-canchas/

## Conclusión

ViewMaster es minimalista. Replicarlo es trivial técnicamente — el 90% del
trabajo es **cargar las coordenadas de greens a mano**. Para uso personal con
3-5 canchas, son ~2 hs total de captura.

Estimación implementación completa: **~4 hs código + ~30 min/cancha** (datos).
