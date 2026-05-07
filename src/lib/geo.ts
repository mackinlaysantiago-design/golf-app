// Cálculo de distancias geográficas

const EARTH_RADIUS_M = 6371000;

// Haversine: distancia en metros entre dos puntos lat/lng
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Metros → yardas (1 yd = 0.9144 m)
export function metersToYards(m: number): number {
  return m / 0.9144;
}

// Distancia directa en yardas
export function yardsBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return metersToYards(haversineMeters(lat1, lng1, lat2, lng2));
}

// Parser tolerante para coords pegadas:
//   "-34.491234, -58.621234"
//   "-34.491234,-58.621234"
//   "-34.491234 -58.621234"
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim().replace(/[,]/g, " ").split(/\s+/).filter(Boolean);
  if (cleaned.length !== 2) return null;
  const lat = parseFloat(cleaned[0]);
  const lng = parseFloat(cleaned[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
