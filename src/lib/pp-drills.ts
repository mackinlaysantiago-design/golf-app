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

// Cómo se evalúa cada drill
export type ScoringMode =
  // PCT_HITS_PERFECT: # exitosos sobre N. Cumple si score == N (perfect run para subir nivel)
  | "PCT_HITS_PERFECT"
  // BEAT_BEST_HIGHER: # exitosos sobre N. Cumple si score > mejor anterior (subir nivel = mejorar marca)
  | "BEAT_BEST_HIGHER"
  // BEAT_BEST_LOWER_BY_1: suma de golpes. Cumple si suma <= mejor anterior - 1 (chipping)
  | "BEAT_BEST_LOWER_BY_1";

export type DrillDef = {
  type: DrillType;
  label: string;
  shortLabel: string;
  description: string;
  defaultDistance: number;
  distanceUnit: "ft" | "yds";
  scoreOf: number;        // 10 putts, 9 hoyos chipping, 9 wedges, etc
  scoreLabel: string;
  scoring: ScoringMode;
  ppCode: "A" | "B" | "1" | "2";
  ppLabel: string;
  // Para drills con progresión por distancia (1-Putt, 2-Putt)
  distanceStep?: number;  // cuánto sube al pasar de nivel
  // Para Go-To Club: ladder de palos
  clubLadder?: string[];
};

// Orden Go-To Club (de más fácil de meter en FW → más difícil)
export const GO_TO_CLUB_LADDER = [
  "IRON_7",
  "IRON_6",
  "IRON_5",
  "IRON_4",
  "IRON_3",
  "HYBRID",
  "WOOD_5",
  "WOOD_3",
  "DRIVER",
];

export const CLUB_LABEL: Record<string, string> = {
  PW: "PW",
  IRON_9: "Hierro 9",
  IRON_8: "Hierro 8",
  IRON_7: "Hierro 7",
  IRON_6: "Hierro 6",
  IRON_5: "Hierro 5",
  IRON_4: "Hierro 4",
  IRON_3: "Hierro 3",
  HYBRID: "Híbrido",
  WOOD_5: "Madera 5",
  WOOD_3: "Madera 3",
  DRIVER: "Driver",
};

export const DRILLS: DrillDef[] = [
  {
    type: "ONE_PUTT_CIRCLE",
    label: "1-putt circle (short putts)",
    shortLabel: "1-Putt",
    description: "10 putts cortos. Si embocás los 10, subís a la próxima distancia.",
    defaultDistance: 3,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "embocados de 10",
    scoring: "PCT_HITS_PERFECT",
    ppCode: "1",
    ppLabel: "Putts errados dentro 1-putt circle",
    distanceStep: 3, // 3ft → 6ft → 9ft → 12ft → ...
  },
  {
    type: "TWO_PUTT_CIRCLE",
    label: "2-putt circle (lag putts)",
    shortLabel: "2-Putt",
    description: "10 putts largos. Cada putt tiene que quedar DENTRO del 1-putt circle. Si los 10 quedan adentro, subís de nivel.",
    defaultDistance: 30,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "dentro 1PC de 10",
    scoring: "PCT_HITS_PERFECT",
    ppCode: "2",
    ppLabel: "Hoyos con 3+ putts",
    distanceStep: 5, // 30ft → 35ft → 40ft → ...
  },
  {
    type: "CHIPPING",
    label: "Chipping circle",
    shortLabel: "Chipping",
    description: "Tirás 9 pelotas a 20 yds. Por cada pelota registrás los golpes para meterla (chip + putts). Para subir nivel: bajar la suma de golpes vs tu mejor marca anterior por al menos 1.",
    defaultDistance: 20,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "golpes por pelota (9 pelotas)",
    scoring: "BEAT_BEST_LOWER_BY_1",
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_50",
    label: "Wedges 50 yds",
    shortLabel: "Wedges 50",
    description: "9 wedges desde 50 yds. Score = cuántos quedan dentro del 2-putt circle. Para subir nivel: superar tu mejor marca anterior.",
    defaultDistance: 50,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "dentro 2PC de 9",
    scoring: "BEAT_BEST_HIGHER",
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_70",
    label: "Wedges 70 yds",
    shortLabel: "Wedges 70",
    description: "9 wedges desde 70 yds. Score = cuántos quedan dentro del 2-putt circle. Para subir nivel: superar tu mejor marca anterior.",
    defaultDistance: 70,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "dentro 2PC de 9",
    scoring: "BEAT_BEST_HIGHER",
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_100",
    label: "Wedges 100 yds",
    shortLabel: "Wedges 100",
    description: "9 wedges desde 100 yds. Score = cuántos quedan dentro del 2-putt circle. Para subir nivel: superar tu mejor marca anterior.",
    defaultDistance: 100,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "dentro 2PC de 9",
    scoring: "BEAT_BEST_HIGHER",
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "GO_TO_CLUB",
    label: "Go-To Club",
    shortLabel: "Go-To Club",
    description: "9 tiros con un palo (driver/madera/hierro). Score = cuántos en fairway. Empezás con Hierro 7. Para subir al siguiente palo: meter 9/9 en fairway. Tu Go-To Club = el palo más alto donde lograste 9/9.",
    defaultDistance: 0,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "en FW de 9",
    scoring: "PCT_HITS_PERFECT",
    ppCode: "A",
    ppLabel: "No entró a SZ",
    clubLadder: GO_TO_CLUB_LADDER,
  },
];

export const DRILL_BY_TYPE: Record<DrillType, DrillDef> = Object.fromEntries(
  DRILLS.map((d) => [d.type, d]),
) as Record<DrillType, DrillDef>;

// El score "del set" según el modo
export function setScore(scoring: ScoringMode, attempts: number[]): number | null {
  const valid = attempts.filter((a) => !isNaN(a));
  if (valid.length === 0) return null;
  if (scoring === "BEAT_BEST_LOWER_BY_1") {
    return valid.reduce((a, b) => a + b, 0);
  }
  // PCT_HITS_PERFECT y BEAT_BEST_HIGHER → max
  return Math.max(...valid);
}

// ¿El intento cumple para subir nivel?
export function meetsTarget(
  drill: DrillDef,
  attempts: number[],
  bestPrevious: number | null,
): boolean {
  const score = setScore(drill.scoring, attempts);
  if (score == null) return false;
  if (drill.scoring === "PCT_HITS_PERFECT") {
    return score === drill.scoreOf;
  }
  if (drill.scoring === "BEAT_BEST_HIGHER") {
    return bestPrevious == null ? false : score > bestPrevious;
  }
  // BEAT_BEST_LOWER_BY_1 (chipping)
  return bestPrevious == null ? false : score <= bestPrevious - 1;
}

// Mejor marca histórica
export function bestHistoricalScore(
  drill: DrillDef,
  pastSets: number[][],
): number | null {
  if (pastSets.length === 0) return null;
  if (drill.scoring === "BEAT_BEST_LOWER_BY_1") {
    let best = Infinity;
    for (const set of pastSets) {
      if (set.length === 0) continue;
      const sum = set.reduce((a, b) => a + b, 0);
      if (sum < best) best = sum;
    }
    return best === Infinity ? null : best;
  }
  // PCT_HITS_PERFECT y BEAT_BEST_HIGHER
  let best = -Infinity;
  for (const set of pastSets) {
    for (const score of set) {
      if (score > best) best = score;
    }
  }
  return best === -Infinity ? null : best;
}
