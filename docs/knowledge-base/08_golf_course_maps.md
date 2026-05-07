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
