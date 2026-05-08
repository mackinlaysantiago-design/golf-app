import L from "leaflet";

// Liang-Barsky: clippea un segmento [p1,p2] dentro de un rect [min,max].
// Devuelve los 2 puntos del segmento clippeado en pixels, o null si no intersecta.
function clipSegment(
  p1: L.Point,
  p2: L.Point,
  min: L.Point,
  max: L.Point,
): [L.Point, L.Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const tests: [number, number][] = [
    [-dx, p1.x - min.x],
    [dx, max.x - p1.x],
    [-dy, p1.y - min.y],
    [dy, max.y - p1.y],
  ];
  for (const [p, q] of tests) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [
    L.point(p1.x + t0 * dx, p1.y + t0 * dy),
    L.point(p1.x + t1 * dx, p1.y + t1 * dy),
  ];
}

// Devuelve el latlng del midpoint visible del segmento [a,b] dentro del viewport
// (con padding para que no quede pegado al borde). Null si no cruza la pantalla.
export function visibleMidLatLng(
  map: L.Map,
  a: L.LatLngExpression,
  b: L.LatLngExpression,
  padding = 28,
): L.LatLng | null {
  const p1 = map.latLngToContainerPoint(a);
  const p2 = map.latLngToContainerPoint(b);
  const size = map.getSize();
  const min = L.point(padding, padding);
  const max = L.point(size.x - padding, size.y - padding);
  const clipped = clipSegment(p1, p2, min, max);
  if (!clipped) return null;
  const mid = L.point(
    (clipped[0].x + clipped[1].x) / 2,
    (clipped[0].y + clipped[1].y) / 2,
  );
  return map.containerPointToLatLng(mid);
}

export function isInViewport(map: L.Map, latlng: [number, number]): boolean {
  const p = map.latLngToContainerPoint(latlng);
  const size = map.getSize();
  return p.x >= 0 && p.x <= size.x && p.y >= 0 && p.y <= size.y;
}
