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

// Cuánto más caro es quedarse corto que pasarse. Quedarse corto en golf suele dejar
// bunker/agua adelante del green, así que se penaliza más — pero se penaliza, no se
// descarta. La versión anterior agarraba SIEMPRE el palo largo del par sin mirar
// cuánto se pasaba: para 152 yd elegía el 5i (166, 14 largo) teniendo el 7i (147,
// 5 corto). El sesgo estaba bien, la calibración no.
const SHORT_PENALTY = 1.5;

/** Costo de un palo para un target: yardas de error, con lo corto penalizado. */
function clubCost(carryYds: number, targetYds: number): number {
  const diff = carryYds - targetYds;
  return diff >= 0 ? diff : -diff * SHORT_PENALTY;
}

/**
 * Sugerencia de palo para una distancia, con la tabla de carries MEDIDA del jugador
 * (ClubDispersion para el juego largo, Wedge Matrix para el corto — ver club-carries.ts).
 * Elige el de menor costo; `alt` es el segundo, para el tap de cambio rápido.
 */
export function suggestClub(
  targetYds: number,
  carries: ClubCarry[],
): { pick: ClubCarry; alt?: ClubCarry } | null {
  const valid = carries.filter((c) => Number.isFinite(c.carryYds));
  if (!valid.length) return null;

  const ranked = [...valid].sort(
    (a, b) => clubCost(a.carryYds, targetYds) - clubCost(b.carryYds, targetYds),
  );
  return { pick: ranked[0], alt: ranked[1] };
}
