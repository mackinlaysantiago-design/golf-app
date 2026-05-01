// Definición de drills PP (Will Robins method)
// Sacado de la planilla "PP" tab

export type DrillType =
  | "ONE_PUTT_CIRCLE"
  | "TWO_PUTT_CIRCLE"
  | "CHIPPING"
  | "WEDGES_50"
  | "WEDGES_70"
  | "WEDGES_100"
  | "GO_TO_CLUB";

// "scoring" describe cómo se evalúa cada intento
export type ScoringMode =
  // 10 putts/wedges/tiros, score = #exitosos. Best = max. Cumple si score/10 >= target.
  | "PCT_HITS"
  // 9 hoyos chipping, score = suma de golpes. Best = min. Cumple si suma <= mejor anterior + delta.
  | "SUM_LOWEST";

export type DrillDef = {
  type: DrillType;
  label: string;
  shortLabel: string;
  description: string;
  defaultDistance: number;
  distanceUnit: "ft" | "yds";
  scoreOf: number;       // 10 putts, 9 hoyos chipping, etc
  scoreLabel: string;
  scoring: ScoringMode;
  defaultTarget: number; // % o golpes según drill
  ppCode: "A" | "B" | "1" | "2";
  ppLabel: string;
};

export const DRILLS: DrillDef[] = [
  {
    type: "ONE_PUTT_CIRCLE",
    label: "1 putt circle - short putts",
    shortLabel: "1-Putt circle",
    description: "10 putts cortos por intento. Cuenta cuántos embocás.",
    defaultDistance: 6,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "embocados de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.7, // 70%
    ppCode: "1",
    ppLabel: "Putts errados dentro 1-putt circle",
  },
  {
    type: "TWO_PUTT_CIRCLE",
    label: "2 putt circle - long putts",
    shortLabel: "2-Putt circle",
    description: "10 putts largos por intento. Cuenta cuántos quedan dentro del 2-putt circle.",
    defaultDistance: 30,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "dentro 2PC de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.8,
    ppCode: "2",
    ppLabel: "Hoyos con 3+ putts",
  },
  {
    type: "CHIPPING",
    label: "3 shot circle - chipping",
    shortLabel: "Chipping circle",
    description: "9 hoyos de chipping (down in 3 desde 20 yds). Suma los golpes de cada hoyo. Objetivo: bajar la suma.",
    defaultDistance: 20,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "golpes por hoyo (9 hoyos)",
    scoring: "SUM_LOWEST",
    defaultTarget: 27, // par 3 x 9 = 27 baseline
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_50",
    label: "Wedges 50 yds",
    shortLabel: "Wedges 50",
    description: "10 wedges desde 50 yds. Cuenta cuántos quedan dentro 2-putt circle.",
    defaultDistance: 50,
    distanceUnit: "yds",
    scoreOf: 10,
    scoreLabel: "dentro 2PC de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.7,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_70",
    label: "Wedges 70 yds",
    shortLabel: "Wedges 70",
    description: "10 wedges desde 70 yds. Cuenta cuántos quedan dentro 2-putt circle.",
    defaultDistance: 70,
    distanceUnit: "yds",
    scoreOf: 10,
    scoreLabel: "dentro 2PC de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.6,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_100",
    label: "Wedges 100 yds",
    shortLabel: "Wedges 100",
    description: "10 wedges desde 100 yds. Cuenta cuántos quedan dentro 2-putt circle.",
    defaultDistance: 100,
    distanceUnit: "yds",
    scoreOf: 10,
    scoreLabel: "dentro 2PC de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.5,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "GO_TO_CLUB",
    label: "Go-To Club",
    shortLabel: "Go-To Club",
    description: "10 tiros con palo de salida (driver/madera). Cuenta cuántos quedan en fairway.",
    defaultDistance: 200,
    distanceUnit: "yds",
    scoreOf: 10,
    scoreLabel: "en fairway de 10",
    scoring: "PCT_HITS",
    defaultTarget: 0.7,
    ppCode: "A",
    ppLabel: "No entró a SZ",
  },
];

export const DRILL_BY_TYPE: Record<DrillType, DrillDef> = Object.fromEntries(
  DRILLS.map((d) => [d.type, d]),
) as Record<DrillType, DrillDef>;

// Helper: best score de una serie de intentos según el modo
export function computeBest(scoring: ScoringMode, attempts: number[]): number | null {
  const valid = attempts.filter((a) => !isNaN(a) && a !== null);
  if (valid.length === 0) return null;
  return scoring === "SUM_LOWEST"
    ? valid.reduce((a, b) => a + b, 0)
    : Math.max(...valid);
}

// Helper: ¿el mejor intento cumple el target?
export function meetsTarget(
  drill: DrillDef,
  attempts: number[],
  target: number,
): boolean {
  if (attempts.length === 0) return false;
  if (drill.scoring === "PCT_HITS") {
    const best = Math.max(...attempts);
    return best / drill.scoreOf >= target;
  }
  // SUM_LOWEST (chipping): suma <= target
  const sum = attempts.reduce((a, b) => a + b, 0);
  return sum <= target;
}

// Compute the "best mark" historical from previous sessions to use as target
export function bestHistoricalScore(
  drill: DrillDef,
  pastAttempts: number[][],
): number | null {
  if (pastAttempts.length === 0) return null;
  if (drill.scoring === "PCT_HITS") {
    let best = 0;
    for (const session of pastAttempts) {
      for (const score of session) {
        if (score > best) best = score;
      }
    }
    return best;
  }
  // SUM_LOWEST: lowest sum across sessions
  let best = Infinity;
  for (const session of pastAttempts) {
    if (session.length === 0) continue;
    const sum = session.reduce((a, b) => a + b, 0);
    if (sum < best) best = sum;
  }
  return best === Infinity ? null : best;
}

