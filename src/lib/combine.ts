// "The Combine" — Skill Test Suite oficial de The Scoring Method (Circle.so,
// curso "The Scoring Method Combine" → lección "The Full Combine Instructions").
// Protocolo FIJO, no configurable por Player — a diferencia de PracticeDrill.
// Texto literal de la lección (05/10/2026):
//
// "Five tests. Ten points each. 50 points in total."
// 1. Short Putts: 5 posiciones a 4 ft del hoyo, pendiente 1°. 2 vueltas = 10 putts.
//    Score: embocó = 1, falló = 0.
// 2. Lag Putting: arranca a 15 ft, retrocede 3 ft cada vez (15,18,21,24,28ft...).
//    Target = círculo de 4 ft alrededor del hoyo (mismo de Short Putts).
//    Score: embocó = 2, adentro del círculo = 1, afuera = 0.
// 3. Chipping: 10 chips desde distintos puntos, adentro de 25 pasos, jugados
//    hasta embocar. Score: chip-in = 2, down-in-2 = 1, down-in-3 = 0.5, down-in-4+ = 0.
// 4. Wedges: 3 tiros desde 50/75/100 yds + 1 a distancia libre (shot 10).
//    Target: dentro del 10% de esa distancia. Score: adentro = 1, afuera = 0.
// 5. Driver ("Go To Club Test" en el índice del curso): 10 tiros. Fairway = 10%
//    de TU carry real, a cada lado. Score: en fairway = 1, afuera = 0.

export type CombineTestType = "SHORT_PUTTS" | "LAG_PUTTS" | "CHIPPING" | "WEDGES" | "DRIVER";

export const COMBINE_ATTEMPTS = 10;

export const COMBINE_TEST_ORDER: CombineTestType[] = [
  "SHORT_PUTTS",
  "LAG_PUTTS",
  "CHIPPING",
  "WEDGES",
  "DRIVER",
];

export const COMBINE_TEST_META: Record<
  CombineTestType,
  { order: number; label: string; icon: string; setup: string }
> = {
  SHORT_PUTTS: {
    order: 1,
    label: "Short Putts",
    icon: "⛳",
    setup: "5 posiciones a 4 ft del hoyo, pendiente 1°. 2 vueltas = 10 putts.",
  },
  LAG_PUTTS: {
    order: 2,
    label: "Lag Putting",
    icon: "🎯",
    setup: "Arranca a 15 ft, retrocede 3 ft cada putt (15, 18, 21, 24, 28ft...).",
  },
  CHIPPING: {
    order: 3,
    label: "Chipping",
    icon: "🪶",
    setup: "10 chips desde puntos distintos, adentro de 25 pasos. Jugá cada uno hasta embocar.",
  },
  WEDGES: {
    order: 4,
    label: "Wedges",
    icon: "🏌️",
    setup: "3 tiros desde 50, 75 y 100 yds. Shot 10 a una distancia que elijas.",
  },
  DRIVER: {
    order: 5,
    label: "Driver",
    icon: "🚀",
    setup: "10 drives. Fairway = 10% de tu carry real, a cada lado.",
  },
};

// ---------- 1. Short Putts ----------
export const SHORT_PUTT_DISTANCE_FT = 4;

export type ShortPuttsData = { hits: boolean[] };

export function shortPuttsScore(d: ShortPuttsData): number {
  return d.hits.filter(Boolean).length;
}

// ---------- 2. Lag Putting ----------
export const LAG_PUTT_CIRCLE_FT = 4;
export const LAG_PUTT_START_FT = 15;
export const LAG_PUTT_STEP_FT = 3;

export type LagPuttOutcome = "HOLED" | "CIRCLE" | "OUT";
export type LagPuttsData = { outcomes: LagPuttOutcome[] };

export function lagPuttDistanceFt(attemptIndex: number): number {
  return LAG_PUTT_START_FT + attemptIndex * LAG_PUTT_STEP_FT;
}

export function lagPuttOutcomePoints(o: LagPuttOutcome): number {
  return o === "HOLED" ? 2 : o === "CIRCLE" ? 1 : 0;
}

export function lagPuttsScore(d: LagPuttsData): number {
  return d.outcomes.reduce((s, o) => s + lagPuttOutcomePoints(o), 0);
}

// ---------- 3. Chipping ----------
export const CHIPPING_MAX_PACES = 25;
// 4 = "down in 4 or peor"
export type ChipStrokes = 1 | 2 | 3 | 4;
export type ChippingData = { strokes: ChipStrokes[] };

export function chipStrokesPoints(n: ChipStrokes): number {
  return n === 1 ? 2 : n === 2 ? 1 : n === 3 ? 0.5 : 0;
}

export function chippingScore(d: ChippingData): number {
  return d.strokes.reduce((s, n) => s + chipStrokesPoints(n), 0);
}

// ---------- 4. Wedges ----------
// Shots 1-3 @ 50yds, 4-6 @ 75yds, 7-9 @ 100yds, shot 10 (índice 9) = distancia libre.
export const WEDGE_FIXED_DISTANCES_YDS = [50, 50, 50, 75, 75, 75, 100, 100, 100];

export type WedgesData = { hits: boolean[]; customDistanceYds: number };

export function wedgeTargetYds(attemptIndex: number, customDistanceYds: number): number {
  return attemptIndex < 9 ? WEDGE_FIXED_DISTANCES_YDS[attemptIndex] : customDistanceYds;
}

export function wedgeWindowYds(targetYds: number): number {
  return targetYds * 0.1;
}

export function wedgesScore(d: WedgesData): number {
  return d.hits.filter(Boolean).length;
}

// ---------- 5. Driver ----------
export type DriverData = { hits: boolean[]; carryYds: number };

export function driverFairwayHalfWidthYds(carryYds: number): number {
  return carryYds * 0.1;
}

export function driverScore(d: DriverData): number {
  return d.hits.filter(Boolean).length;
}

// ---------- Unión discriminada por test ----------
export type CombineAttemptsByType = {
  SHORT_PUTTS: ShortPuttsData;
  LAG_PUTTS: LagPuttsData;
  CHIPPING: ChippingData;
  WEDGES: WedgesData;
  DRIVER: DriverData;
};

export function scoreForTest<T extends CombineTestType>(
  type: T,
  data: CombineAttemptsByType[T],
): number {
  switch (type) {
    case "SHORT_PUTTS":
      return shortPuttsScore(data as ShortPuttsData);
    case "LAG_PUTTS":
      return lagPuttsScore(data as LagPuttsData);
    case "CHIPPING":
      return chippingScore(data as ChippingData);
    case "WEDGES":
      return wedgesScore(data as WedgesData);
    case "DRIVER":
      return driverScore(data as DriverData);
  }
  // unreachable — CombineTestType está cerrado
  return 0;
}

/** Score total del Combine = suma de los 5 tests. "50 points in total" es el nominal
 * de la lección (10 por test); Lag Putting y Chipping pueden superarlo si el jugador
 * embocó mucho — no hay cap, así lo puntúa el protocolo oficial. */
export function totalScore(scores: Record<CombineTestType, number>): number {
  return COMBINE_TEST_ORDER.reduce((sum, t) => sum + (scores[t] ?? 0), 0);
}

export const COMBINE_NOMINAL_TOTAL = COMBINE_TEST_ORDER.length * 10;
