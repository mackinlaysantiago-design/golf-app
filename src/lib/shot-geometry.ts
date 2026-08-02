// Geometría de un tiro: separar DECISIÓN de EJECUCIÓN.
//
// Con tres puntos —de dónde pegaste (O), a dónde apuntabas (T) y dónde cayó (L)—
// se puede decir "apuntaste al centro y saliste 20 yd a la izquierda, 15 corto".
// Eso es lo que ninguna app comercial te da: ellas registran el resultado y te
// preguntan el palo después, cuando ya sabés cómo salió.
//
// Puro, sin React ni DB.

import type { LatLng } from "./shot-gps";

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG_EQ = 111_320;
const YD_PER_M = 1.09361;

/** Proyección local plana (ENU) en metros alrededor de `origin`. A escala de un hoyo el error es despreciable. */
function toLocalMeters(origin: LatLng, p: LatLng): { x: number; y: number } {
  const latRad = (origin.lat * Math.PI) / 180;
  return {
    x: (p.lng - origin.lng) * Math.cos(latRad) * M_PER_DEG_LNG_EQ, // este +
    y: (p.lat - origin.lat) * M_PER_DEG_LAT, // norte +
  };
}

export type ShotDeviation = {
  /** Desvío lateral en yardas: + derecha, − izquierda. */
  lateralYds: number;
  /** Avance sobre la línea al target: + pasado, − corto. */
  alongErrorYds: number;
  /** Largo real del tiro (O → L) en yardas. */
  shotLengthYds: number;
  /** Distancia planeada (O → T) en yardas. */
  plannedYds: number;
};

/**
 * Desvío de un tiro respecto de su plan.
 * Devuelve null si el target coincide con el origen (no hay línea que medir).
 */
export function computeDeviation(
  from: LatLng,
  target: LatLng,
  landed: LatLng,
): ShotDeviation | null {
  const t = toLocalMeters(from, target);
  const l = toLocalMeters(from, landed);

  const planned = Math.hypot(t.x, t.y);
  if (planned < 1) return null; // target encima del origen

  // Componente perpendicular: el producto cruzado en ENU da + a la IZQUIERDA,
  // así que se invierte el signo para que + sea derecha (como se lee un tiro).
  const cross = t.x * l.y - t.y * l.x;
  const lateralM = -cross / planned;
  // Componente sobre la línea, menos lo planeado: cuánto te pasaste o te quedaste.
  const alongM = (t.x * l.x + t.y * l.y) / planned;

  return {
    lateralYds: Math.round(lateralM * YD_PER_M),
    alongErrorYds: Math.round((alongM - planned) * YD_PER_M),
    shotLengthYds: Math.round(Math.hypot(l.x, l.y) * YD_PER_M),
    plannedYds: Math.round(planned * YD_PER_M),
  };
}

/**
 * ¿Vale la pena mostrar este desvío? El GPS del teléfono tiene ~3-5 m de error, y
 * hay error en las DOS puntas (dónde pegaste y dónde cayó). Por debajo de eso el
 * número es ruido y no hay que mostrarlo como si fuera una medición.
 */
export function deviationIsMeaningful(
  lateralYds: number,
  gpsAccuracyM: number | null,
): boolean {
  const accM = gpsAccuracyM ?? 5;
  const noiseYds = accM * Math.SQRT2 * YD_PER_M; // error en origen y en llegada
  return Math.abs(lateralYds) > noiseYds;
}

/** Texto corto del desvío, para el nodo del mapa. */
export function describeDeviation(d: ShotDeviation): string {
  const lado = d.lateralYds === 0 ? null : `${Math.abs(d.lateralYds)} ${d.lateralYds > 0 ? "der" : "izq"}`;
  const largo =
    d.alongErrorYds === 0 ? null : `${Math.abs(d.alongErrorYds)} ${d.alongErrorYds > 0 ? "largo" : "corto"}`;
  const partes = [lado, largo].filter(Boolean);
  return partes.length ? partes.join(" · ") : "en la línea";
}
