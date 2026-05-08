import L from "leaflet";

// "Destination point" (Vincenty/spherical): dado un punto, una distancia (m) y un bearing (°),
// devuelve el lat/lng resultante. Se usa para offset de puntos en la elipse.
const EARTH_M = 6371000;
function destPoint(lat: number, lng: number, distM: number, bearingDeg: number): [number, number] {
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lng * Math.PI) / 180;
  const theta = (bearingDeg * Math.PI) / 180;
  const delta = distM / EARTH_M;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return [(phi2 * 180) / Math.PI, (((lambda2 * 180) / Math.PI + 540) % 360) - 180];
}

// Bearing en grados desde norte entre 2 lat/lng.
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const x = Math.sin(dLambda) * Math.cos(phi2);
  const y =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

const YDS_TO_M = 0.9144;

// Genera el polígono de la elipse 2σ en lat/lng.
// - Centrada en el "punto medio" del palo: meanTotal yardas en la línea jugador→target,
//   con offset lateral de meanLateral yardas (perpendicular a esa línea).
// - Ejes: a=2*stdLateral (lateral), b=2*stdTotal (longitudinal) → ~80% confianza bivariada normal.
// - Orientada con el eje longitudinal alineado a jugador→target.
export function buildDispersionEllipse(args: {
  userLat: number;
  userLng: number;
  targetLat: number;
  targetLng: number;
  meanTotalYds: number;
  stdTotalYds: number;
  meanLateralYds: number; // signed: + = derecha
  stdLateralYds: number;
  segments?: number;
}): L.LatLngTuple[] {
  const segments = args.segments ?? 64;
  const shotBearing = bearingDeg(args.userLat, args.userLng, args.targetLat, args.targetLng);

  // Centro de la elipse: meanTotal yardas hacia el target + offset lateral perpendicular.
  const [centerLat0, centerLng0] = destPoint(
    args.userLat,
    args.userLng,
    args.meanTotalYds * YDS_TO_M,
    shotBearing,
  );
  const [centerLat, centerLng] = destPoint(
    centerLat0,
    centerLng0,
    Math.abs(args.meanLateralYds) * YDS_TO_M,
    shotBearing + (args.meanLateralYds >= 0 ? 90 : -90),
  );

  const a = 2 * args.stdLateralYds * YDS_TO_M; // semi-eje lateral en metros
  const b = 2 * args.stdTotalYds * YDS_TO_M; // semi-eje longitudinal en metros

  const points: L.LatLngTuple[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const xLat = a * Math.cos(theta); // metros perpendicular a la línea
    const yLong = b * Math.sin(theta); // metros a lo largo de la línea
    const distM = Math.sqrt(xLat * xLat + yLong * yLong);
    if (distM < 0.01) {
      points.push([centerLat, centerLng]);
      continue;
    }
    // angle relativo a "longitudinal" (yLong): atan2(xLat, yLong) = 0 cuando todo es longitudinal.
    const localBearing = (Math.atan2(xLat, yLong) * 180) / Math.PI;
    const worldBearing = shotBearing + localBearing;
    points.push(destPoint(centerLat, centerLng, distM, worldBearing));
  }
  return points;
}
