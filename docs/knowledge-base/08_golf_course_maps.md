# Mapas/imágenes de campos de golf — research

## Cómo lo hacen las apps grandes

Las apps premium (Hole19, Arccos, 18Birdies) **no comparten una sola fuente pública**.
Combinan 3 approaches:
1. **Equipos internos** que dibujan polígonos sobre satellite imagery (Mapbox/Google).
2. **Crowdsourcing**: usuarios reportan cambios.
3. **Licencian datos** de mayoristas como **iGolf** (40k+ courses) o **GolfLogix**,
   proveedores B2B detrás de muchas apps + Garmin.

Garmin tiene dataset propietario, **no expone API pública**. Connect IQ es para apps
que corren en el reloj, no para mapas.

## 4 opciones para apps personales

### 1. GolfCourseAPI — `golfcourseapi.com` ⭐ RECOMENDADA
- ~30.000 courses, plan gratis 300 req/día, signup solo email
- Pros: gratis, ideal hobby apps, REST simple
- Contras: no queda claro si trae polígonos de fairway/green o solo coords. Argentina sin confirmar

### 2. OpenStreetMap + Overpass API ⭐ RECOMENDADA combinable
- Gratis, ilimitado. Tags: `leisure=golf_course`, `golf=fairway|green|tee|bunker|water_hazard|rough`
- Query vía `overpass-turbo.eu`
- Pros: completamente libre, polígonos reales, editable
- Contras: cobertura Argentina desigual. Calidad del tagging variable
- Combinar con **tiles satelitales de Mapbox** (50k loads/mes free) para el render

### 3. golfapi.io
- 42k+ courses, 100+ países, REST + CSV
- No publican precio (mala señal para hobby)

### 4. Golf Intelligence
- Free tier 200 credits one-time, $399-$15k/mes después
- Caro

## Stack recomendado para esta app

1. **GolfCourseAPI** (free) → metadata + scorecard + coords tee/green
2. **OSM/Overpass** → polígonos fairway/green/bunker (gratis, editable)
3. **Mapbox Satellite** o **Google Maps Static API** → raster aéreo de fondo
4. **Fallback manual**: para los 5-10 campos argentinos que jugás (Olivos, Pilar,
   Jockey, Nordelta, Martindale, etc.), si OSM viene flojo, dibujás los polígonos
   vos una vez en `geojson.io` y los guardás en la DB. ~30 min por campo.

## URLs de referencia

- https://golfcourseapi.com/
- https://wiki.openstreetmap.org/wiki/Key:golf
- https://wiki.openstreetmap.org/wiki/Tag:leisure=golf_course
- https://community.openstreetmap.org/t/fairwaymapper-introducing-golfers-to-mapping/142814
- https://github.com/leif81/osmgolf
- https://www.golfapi.io/
- https://golfintelligence.com/api-pricing/
- https://igolf.com/solutions/golf-course-data/
- https://maps4golf.com/
- https://www.golflogix.com/page/map-licensing-inquiries/
- https://www.hole19golf.com/courses/countries/argentina/regions/buenos-aires

## Próximo paso si querés implementarlo

Empezar con OSM + Mapbox:
1. Crear `Course.geojson` (Json?) en schema
2. Endpoint para importar de Overpass dado el bounding box de un course
3. Componente `<CourseMap>` que renderiza con Mapbox GL
4. Si OSM no tiene tu campo, dibujás en `geojson.io` y lo pegás manual

Estimación: ~5-8 hs para tener la primera versión con 1-2 campos cargados.

---

## Opciones 100% GRATIS (sin tarjeta, sin tier pago)

### Opción A — ESRI World Imagery + OSM Overpass ⭐ RECOMENDADA
- **Tiles satelitales**: ESRI ArcGIS World Imagery vía XYZ directo, **sin API key, sin signup**
  - URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  - Listado en `leaflet-providers` como `Esri.WorldImagery`
  - Cobertura global alta resolución (Maxar/Vivid en zonas urbanas, hasta zoom 19)
  - Sin límite documentado para uso no comercial; solo requiere atribución
    "Esri, Maxar, Earthstar Geographics"
- **Polígonos**: Overpass API con `leisure=golf_course` + `golf=fairway|green|tee|bunker|rough|water_hazard`
- **Sacrificio vs Mapbox pago**: no vector tiles (sin styling custom), tiles a
  veces desactualizados 1-3 años en zonas rurales, no 3D/terrain

### Opción B — IGN Argentina + Overpass (solo AR)
- **Tiles**: IGN Argentina TMS público sin key:
  `https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png`
- 100% gratis, datos oficiales del estado argentino
- Sacrificio: zoom máximo y resolución menor que ESRI (mejor capa secundaria
  con toponimia oficial sobre ESRI World Imagery)

### Opción C — geojson.io a mano + servir overlay
- **geojson.io** (gratis, sin signup, capa Satellite embebida) — trazás
  fairway/green/bunker manualmente y exportás GeoJSON
- Para hoyos donde OSM no tiene polígonos detallados
- Alternativa desktop: **QGIS** (profesional, gratis)

### Datasets pre-armados
- https://github.com/TheMapSmith/GeoJSON-GolfCourses — boundaries de courses OSM listos
- Geofabrik exports por país (incluye Argentina) para bulk

### Combinación recomendada (cero signup, cero tarjeta)
**Leaflet o MapLibre** + **ESRI World Imagery** como base + **GeoJSON de Overpass** (o dibujado en geojson.io) como overlay vectorial coloreado.

Lo único que se sacrifica vs Mapbox: vector tiles styling, terrain 3D, refresh del satelital.

**URLs clave**:
- https://github.com/leaflet-extras/leaflet-providers
- https://overpass-turbo.eu
- https://geojson.io
- https://www.ign.gob.ar/AreaServicios/Geoservicios
- https://github.com/TheMapSmith/GeoJSON-GolfCourses
