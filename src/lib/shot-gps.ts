// F1 — Geo de tiro on-course (Shot Tracking).
// Reutiliza yardsBetween() de geo.ts y los CourseMapPoint (frente/centro/fondo)
// que ya cargamos en labs/maps. Puro y testeable, sin dependencias de React/DB.

import { yardsBetween } from "./geo";

export type LatLng = { lat: number; lng: number };

// Subconjunto de CourseMapPoint que necesitamos (el green del hoyo).
export type HoleGreen = {
  frontLat: number | null;
  frontLng: number | null;
  centerLat: number | null;
  centerLng: number | null;
  backLat: number | null;
  backLng: number | null;
};

export type ShotGeo = {
  distToFrontYds: number | null;
  distToCenterYds: number | null;
  distToBackYds: number | null;
  shotLengthYds: number | null; // largo del tiro anterior → esta posición
};

function distYds(from: LatLng, tLat: number | null, tLng: number | null): number | null {
  if (tLat == null || tLng == null) return null;
  return Math.round(yardsBetween(from.lat, from.lng, tLat, tLng));
}

/**
 * Geo de un tiro: dónde estás parado (`from`) respecto al green del hoyo, y cuánto
 * midió el tiro anterior (`prev` → `from`). Todo en yardas redondeadas.
 */
export function computeShotGeo(
  from: LatLng,
  green: HoleGreen,
  prev?: LatLng | null,
): ShotGeo {
  return {
    distToFrontYds: distYds(from, green.frontLat, green.frontLng),
    distToCenterYds: distYds(from, green.centerLat, green.centerLng),
    distToBackYds: distYds(from, green.backLat, green.backLng),
    shotLengthYds:
      prev != null
        ? Math.round(yardsBetween(prev.lat, prev.lng, from.lat, from.lng))
        : null,
  };
}

export type ClubCarry = { club: string; carryYds: number };

// Tolerancia (yd): si el palo más corto queda a <= esto del target, alcanza con un
// swing normal y no vale la pena subir de palo.
const REACH_TOL_YDS = 3;

/**
 * Sugerencia de palo para una distancia, con la tabla de carries del jugador (FlightScope).
 * Toma los dos palos que "bracketean" el target y, con la tendencia anti-corto de Santi,
 * prefiere el más LARGO — salvo que el más corto llegue dentro de REACH_TOL_YDS.
 * `alt` = el otro palo del bracket.
 */
export function suggestClub(
  targetYds: number,
  carries: ClubCarry[],
): { pick: ClubCarry; alt?: ClubCarry } | null {
  const valid = carries.filter((c) => Number.isFinite(c.carryYds));
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => a.carryYds - b.carryYds);

  let shorter: ClubCarry | undefined; // mayor carry <= target
  let longer: ClubCarry | undefined; // menor carry >= target
  for (const c of sorted) {
    if (c.carryYds <= targetYds) shorter = c;
    if (c.carryYds >= targetYds) {
      longer = c;
      break;
    }
  }
  if (!shorter) return { pick: longer ?? sorted[0] }; // target más corto que todos
  if (!longer) return { pick: shorter }; // target más largo que todos → máximo palo

  const shortBy = targetYds - shorter.carryYds; // >= 0
  return shortBy <= REACH_TOL_YDS
    ? { pick: shorter, alt: longer }
    : { pick: longer, alt: shorter }; // anti-corto: mejor llegar
}
