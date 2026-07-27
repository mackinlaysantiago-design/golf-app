// Definición de drills PP (Will Robins method)
// Sacado de la planilla "PP" tab

export type DrillType =
  | "ONE_PUTT_CIRCLE"
  | "TWO_PUTT_CIRCLE"
  | "CHIPPING"
  | "WEDGES_50"
  | "WEDGES_70"
  | "WEDGES_100"
  | "GO_TO_CLUB"
  // SM Level 2 / Chipping Protocol / 7-Day Putting Challenge
  | "CHIPPING_ONE_HAND"
  | "CHIPPING_CLUB_FRONT"
  | "PUTTING_START_LINE"
  | "PUTTING_SWORD"
  | "PUTTING_LAG_STAKES"
  | "GREEN_READING"
  | "SHORT_PUTTING_STREAK";

// Áreas de juego para agrupar drills en la UI
export type DrillArea = "PUTTING" | "CHIPPING" | "WEDGES" | "LONG_GAME";

export const DRILL_AREA_LABEL: Record<DrillArea, string> = {
  PUTTING: "🟢 Putting",
  CHIPPING: "🪶 Chipping",
  WEDGES: "🎯 Wedges",
  LONG_GAME: "🏌️ Long Game",
};

// Formato del attemptsJson por tipo de drill
//   STREAK_BY_DIST     — 1-putt, 2-putt: cada intento es {distance, streak} (cuántas seguidas embocaste antes de errar)
//   RATIO_LOWER_BY_DIST — chipping: cada intento es {distance, strokes, balls}; ratio = strokes/balls (más bajo = mejor)
//   RATIO_HIGHER       — wedges 50/70/100: cada intento es {inTarget, balls}; ratio = inTarget/balls (más alto = mejor)
//   LEGACY_NUMBER_ARRAY — go-to-club + datos viejos: number[]
export type AttemptFormat =
  | "STREAK_BY_DIST"
  | "RATIO_LOWER_BY_DIST"
  | "RATIO_HIGHER"
  | "GO_TO_DIR" // Go-To Club: por tanda de 9 → {fw, left, right} (pedido Santi 27/07)
  | "LEGACY_NUMBER_ARRAY";

export type StreakAttempt = { distance: number; streak: number };
export type GoToDirAttempt = { fw: number; left: number; right: number };
export type RatioLowerAttempt = { distance: number; strokes: number; balls: number };
export type RatioHigherAttempt = { inTarget: number; balls: number };

export type AttemptsData =
  | { type: "STREAK_BY_DIST"; attempts: StreakAttempt[] }
  | { type: "RATIO_LOWER_BY_DIST"; attempts: RatioLowerAttempt[] }
  | { type: "RATIO_HIGHER"; attempts: RatioHigherAttempt[] }
  | { type: "GO_TO_DIR"; attempts: GoToDirAttempt[] }
  | { type: "LEGACY_NUMBER_ARRAY"; attempts: number[] };

// Cómo se evalúa cada drill (modo viejo, mantenido para Go-To Club + lecturas legacy)
export type ScoringMode =
  | "PCT_HITS_PERFECT"
  | "BEAT_BEST_HIGHER"
  | "BEAT_BEST_LOWER_BY_1";

export type DrillDef = {
  type: DrillType;
  label: string;
  shortLabel: string;
  description: string;
  area: DrillArea;
  defaultDistance: number;
  distanceUnit: "ft" | "yds" | "°"; // unidad NATIVA (benchmarks TSM); la UI muestra pasos (1 paso = 3 ft = 1 yd)
  scoreOf: number;
  scoreLabel: string;
  scoring: ScoringMode;
  format: AttemptFormat;
  // Si se sube de nivel automáticamente al lograr el target
  hasLevelUp: boolean;
  // Cuántas seguidas/qué umbral define "subir nivel" (solo aplica a STREAK_BY_DIST)
  levelUpStreak?: number;
  ppCode: "A" | "B" | "1" | "2";
  ppLabel: string;
  // Para drills con progresión por distancia (1-Putt, 2-Putt) — referencia legacy
  distanceStep?: number;
  // Para Go-To Club: ladder de palos
  clubLadder?: string[];
};

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
    description: "Cada intento: cuántos putts embocás seguidos antes de errar. Si en algún intento metés 10 seguidos a la distancia actual, subís de nivel.",
    area: "PUTTING",
    defaultDistance: 3,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "racha de putts seguidos",
    scoring: "PCT_HITS_PERFECT",
    format: "STREAK_BY_DIST",
    hasLevelUp: true,
    levelUpStreak: 10,
    ppCode: "1",
    ppLabel: "Putts errados dentro 1-putt circle",
    distanceStep: 3,
  },
  {
    type: "TWO_PUTT_CIRCLE",
    label: "2-putt circle (lag putts)",
    shortLabel: "2-Putt",
    description: "Cada intento: cuántos lag putts dejás dentro del 1-putt circle seguidos antes de quedar afuera. 10 seguidos a la distancia actual = subís de nivel.",
    area: "PUTTING",
    defaultDistance: 30,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "racha de putts seguidos",
    scoring: "PCT_HITS_PERFECT",
    format: "STREAK_BY_DIST",
    hasLevelUp: true,
    levelUpStreak: 10,
    ppCode: "2",
    ppLabel: "Hoyos con 3+ putts",
    distanceStep: 6, // múltiplo de 3 ft = 2 pasos justos
  },
  {
    type: "CHIPPING",
    label: "Chipping circle",
    shortLabel: "Chipping",
    description: "Cada intento: golpes totales para meter N pelotas a una distancia X. El ratio (golpes/pelota, más bajo es mejor) se compara contra el mejor previo a la misma distancia.",
    area: "CHIPPING",
    defaultDistance: 20,
    distanceUnit: "yds",
    scoreOf: 0,
    scoreLabel: "ratio golpes/pelota",
    scoring: "BEAT_BEST_LOWER_BY_1",
    format: "RATIO_LOWER_BY_DIST",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_50",
    label: "Wedges 50 yds",
    shortLabel: "Wedges 50",
    description: "Cada intento: cuántas pelotas dejás dentro del 2-putt circle de N pelotas tiradas. Ratio (% dentro) se compara contra el mejor previo.",
    area: "WEDGES",
    defaultDistance: 50,
    distanceUnit: "yds",
    scoreOf: 0,
    scoreLabel: "% dentro del 2-putt circle",
    scoring: "BEAT_BEST_HIGHER",
    format: "RATIO_HIGHER",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_70",
    label: "Wedges 70 yds",
    shortLabel: "Wedges 70",
    description: "Cada intento: cuántas pelotas dejás dentro del 2-putt circle de N pelotas tiradas. Ratio (% dentro) se compara contra el mejor previo.",
    area: "WEDGES",
    defaultDistance: 70,
    distanceUnit: "yds",
    scoreOf: 0,
    scoreLabel: "% dentro del 2-putt circle",
    scoring: "BEAT_BEST_HIGHER",
    format: "RATIO_HIGHER",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "WEDGES_100",
    label: "Wedges 100 yds",
    shortLabel: "Wedges 100",
    description: "Cada intento: cuántas pelotas dejás dentro del 2-putt circle de N pelotas tiradas. Ratio (% dentro) se compara contra el mejor previo.",
    area: "WEDGES",
    defaultDistance: 100,
    distanceUnit: "yds",
    scoreOf: 0,
    scoreLabel: "% dentro del 2-putt circle",
    scoring: "BEAT_BEST_HIGHER",
    format: "RATIO_HIGHER",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Did not get down in 3 desde SZ",
  },
  {
    type: "GO_TO_CLUB",
    label: "Go-To Club",
    shortLabel: "Go-To Club",
    description: "9 tiros con un palo (driver/madera/hierro). Score = cuántos en fairway. Empezás con Hierro 7. Para subir al siguiente palo: meter 9/9 en fairway. Tu Go-To Club = el palo más alto donde lograste 9/9.",
    area: "LONG_GAME",
    defaultDistance: 0,
    distanceUnit: "yds",
    scoreOf: 9,
    scoreLabel: "en FW de 9",
    scoring: "PCT_HITS_PERFECT",
    format: "GO_TO_DIR",
    hasLevelUp: true,
    ppCode: "A",
    ppLabel: "No entró a SZ",
    clubLadder: GO_TO_CLUB_LADDER,
  },
  // ============ Chipping Protocol drills ============
  {
    type: "CHIPPING_ONE_HAND",
    label: "Chipping mano derecha",
    shortLabel: "Chip 1H",
    description: "3 bolas, solo con la mano derecha, 10-13 pasos. Cada intento es tu sensación 1-5 sobre mantener el ángulo de muñeca durante el stroke ('tocar el clavo').",
    area: "CHIPPING",
    defaultDistance: 35,
    distanceUnit: "ft",
    scoreOf: 5,
    scoreLabel: "rating 1-5",
    scoring: "BEAT_BEST_HIGHER",
    format: "LEGACY_NUMBER_ARRAY",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Chipping protocol",
  },
  {
    type: "CHIPPING_CLUB_FRONT",
    label: "Chipping con palo delante",
    shortLabel: "Chip CF",
    description: "3 bolas con un palo en el suelo 8-12 pulgadas delante de la bola, solo mano derecha. Fuerza un ángulo de ataque pronunciado. Rating 1-5 por intento.",
    area: "CHIPPING",
    defaultDistance: 30,
    distanceUnit: "ft",
    scoreOf: 5,
    scoreLabel: "rating 1-5",
    scoring: "BEAT_BEST_HIGHER",
    format: "LEGACY_NUMBER_ARRAY",
    hasLevelUp: false,
    ppCode: "B",
    ppLabel: "Chipping protocol",
  },
  // ============ 7-Day Putting Challenge drills ============
  {
    type: "PUTTING_START_LINE",
    label: "Start line (línea de tiza)",
    shortLabel: "Start Line",
    description: "Línea de tiza en el green, bola con línea marcada. Objetivo: rodar la bola 'end over end' sobre la línea. Rating 1-5 sobre cuántos rodaron rectos.",
    area: "PUTTING",
    defaultDistance: 5,
    distanceUnit: "ft",
    scoreOf: 5,
    scoreLabel: "rating 1-5",
    scoring: "BEAT_BEST_HIGHER",
    format: "LEGACY_NUMBER_ARRAY",
    hasLevelUp: false,
    ppCode: "1",
    ppLabel: "Putting Challenge",
  },
  {
    type: "PUTTING_SWORD",
    label: "Putting sword (regla metálica)",
    shortLabel: "Sword",
    description: "Bola sobre regla metálica. Objetivo: rodarla sin que se caiga. Rating 1-5 por intentos.",
    area: "PUTTING",
    defaultDistance: 3,
    distanceUnit: "ft",
    scoreOf: 5,
    scoreLabel: "rating 1-5",
    scoring: "BEAT_BEST_HIGHER",
    format: "LEGACY_NUMBER_ARRAY",
    hasLevelUp: false,
    ppCode: "1",
    ppLabel: "Putting Challenge",
  },
  {
    type: "PUTTING_LAG_STAKES",
    label: "Lag putting con estacas",
    shortLabel: "Lag Stakes",
    description: "Estacas a 5/7/10 pasos (cuesta arriba/abajo). 3 bolas por distancia. Objetivo: pasar el tee pero no la estaca. Score = cuántos quedaron en la zona.",
    area: "PUTTING",
    defaultDistance: 15,
    distanceUnit: "ft",
    scoreOf: 3,
    scoreLabel: "bolas en zona de 3",
    scoring: "PCT_HITS_PERFECT",
    format: "STREAK_BY_DIST",
    hasLevelUp: false,
    ppCode: "2",
    ppLabel: "Putting Challenge",
    distanceStep: 6, // múltiplo de 3 ft = 2 pasos justos
  },
  {
    type: "GREEN_READING",
    label: "Lectura de greens",
    shortLabel: "Green Reading",
    description: "Putts con pendientes de 1°, 2°, 3° (L-R y R-L). Objetivo: 3 seguidos por pendiente. Distance = grados de pendiente.",
    area: "PUTTING",
    defaultDistance: 1,
    distanceUnit: "°",
    scoreOf: 3,
    scoreLabel: "rachas de 3",
    scoring: "PCT_HITS_PERFECT",
    format: "STREAK_BY_DIST",
    hasLevelUp: false,
    ppCode: "1",
    ppLabel: "Putting Challenge",
  },
  {
    type: "SHORT_PUTTING_STREAK",
    label: "Short Putting 10-in-a-row",
    shortLabel: "Streak 10",
    description: "5 tees a 1-2 pasos en pendiente de 2°. Objetivo: 10 putts consecutivos sin fallar. Cada intento es tu mejor racha en la sesión.",
    area: "PUTTING",
    defaultDistance: 4,
    distanceUnit: "ft",
    scoreOf: 10,
    scoreLabel: "racha de putts seguidos",
    scoring: "PCT_HITS_PERFECT",
    format: "STREAK_BY_DIST",
    hasLevelUp: true,
    levelUpStreak: 10,
    ppCode: "1",
    ppLabel: "Short putting streak",
  },
];


// ============ Unidades: nativo (benchmarks TSM) vs UI (pasos) ============
// Récords y attemptsJson se guardan SIEMPRE en la unidad nativa del drill (ft/yds)
// para poder comparar contra los benchmarks del método. La UI muestra pasos
// (1 paso = 3 ft = 1 yd). GREEN_READING usa grados: sin conversión.

export function uiUnit(def: DrillDef): string {
  return def.distanceUnit === "°" ? "°" : "pasos";
}

/** nativo → pasos (para mostrar). ft/3 redondeado a ENTERO (no existen los pasos con coma); yds 1:1; ° identidad. */
export function distToUi(def: DrillDef, v: number): number {
  if (def.distanceUnit === "ft") return Math.max(1, Math.round(v / 3));
  return v;
}

/** pasos → nativo (para guardar). pasos*3 en ft; yds 1:1; ° identidad. */
export function uiToDist(def: DrillDef, v: number): number {
  if (def.distanceUnit === "ft") return Math.round(v * 3);
  return v;
}

// Código de la Purposeful Practice Card (A/B/1/2) → drills que lo atacan.
// Única fuente para /api/pp/plan y los CTA de homework.
export const PP_CODE_TO_DRILLS: Record<string, DrillType[]> = {
  A: ["GO_TO_CLUB"],
  B: ["CHIPPING", "WEDGES_50", "WEDGES_70", "WEDGES_100"],
  "1": ["ONE_PUTT_CIRCLE"],
  "2": ["TWO_PUTT_CIRCLE"],
};

export const DRILL_BY_TYPE: Record<DrillType, DrillDef> = Object.fromEntries(
  DRILLS.map((d) => [d.type, d]),
) as Record<DrillType, DrillDef>;

// ============ Parsing del attemptsJson ============

// Detecta el formato y parsea. Tolerante con datos viejos.
export function parseAttempts(raw: unknown, format: AttemptFormat): AttemptsData {
  if (raw == null) return emptyOf(format);

  // Old shape: number[]
  if (Array.isArray(raw) && raw.every((x) => typeof x === "number")) {
    if (format === "LEGACY_NUMBER_ARRAY") {
      return { type: "LEGACY_NUMBER_ARRAY", attempts: raw as number[] };
    }
    // Datos viejos cargados antes del refactor — los exponemos como legacy
    return { type: "LEGACY_NUMBER_ARRAY", attempts: raw as number[] };
  }

  // New shape: { type, attempts }
  if (typeof raw === "object" && raw !== null && "type" in raw && "attempts" in raw) {
    const o = raw as { type: string; attempts: unknown[] };
    if (o.type === "STREAK_BY_DIST") {
      return { type: "STREAK_BY_DIST", attempts: (o.attempts as StreakAttempt[]) ?? [] };
    }
    if (o.type === "RATIO_LOWER_BY_DIST") {
      return { type: "RATIO_LOWER_BY_DIST", attempts: (o.attempts as RatioLowerAttempt[]) ?? [] };
    }
    if (o.type === "RATIO_HIGHER") {
      return { type: "RATIO_HIGHER", attempts: (o.attempts as RatioHigherAttempt[]) ?? [] };
    }
    if (o.type === "GO_TO_DIR") {
      return { type: "GO_TO_DIR", attempts: (o.attempts as GoToDirAttempt[]) ?? [] };
    }
  }

  return emptyOf(format);
}

function emptyOf(format: AttemptFormat): AttemptsData {
  if (format === "STREAK_BY_DIST") return { type: "STREAK_BY_DIST", attempts: [] };
  if (format === "GO_TO_DIR") return { type: "GO_TO_DIR", attempts: [] };
  if (format === "RATIO_LOWER_BY_DIST") return { type: "RATIO_LOWER_BY_DIST", attempts: [] };
  if (format === "RATIO_HIGHER") return { type: "RATIO_HIGHER", attempts: [] };
  return { type: "LEGACY_NUMBER_ARRAY", attempts: [] };
}

// ============ Aggregations ============

// Para STREAK_BY_DIST: máximo streak por distancia
export function maxStreakByDistance(attempts: StreakAttempt[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const a of attempts) {
    if (typeof a.distance !== "number" || typeof a.streak !== "number") continue;
    out[a.distance] = Math.max(out[a.distance] ?? 0, a.streak);
  }
  return out;
}

// Para RATIO_LOWER_BY_DIST: ratio agregado por distancia
export function ratioLowerByDistance(
  attempts: RatioLowerAttempt[],
): Record<number, { strokes: number; balls: number; ratio: number }> {
  const out: Record<number, { strokes: number; balls: number; ratio: number }> = {};
  for (const a of attempts) {
    if (typeof a.distance !== "number" || typeof a.strokes !== "number" || typeof a.balls !== "number") continue;
    if (a.balls <= 0) continue;
    const cur = out[a.distance] ?? { strokes: 0, balls: 0, ratio: 0 };
    cur.strokes += a.strokes;
    cur.balls += a.balls;
    cur.ratio = cur.strokes / cur.balls;
    out[a.distance] = cur;
  }
  return out;
}

// Para RATIO_HIGHER: ratio agregado de la sesión
export function ratioHigherTotal(
  attempts: RatioHigherAttempt[],
): { inTarget: number; balls: number; ratio: number } | null {
  let inTarget = 0;
  let balls = 0;
  for (const a of attempts) {
    if (typeof a.inTarget !== "number" || typeof a.balls !== "number") continue;
    inTarget += a.inTarget;
    balls += a.balls;
  }
  if (balls === 0) return null;
  return { inTarget, balls, ratio: inTarget / balls };
}

// ============ Level up ============

// Para drills con hasLevelUp: ¿esta sesión sube de nivel?
// STREAK_BY_DIST: si algún intento alcanza levelUpStreak (típicamente 10)
// LEGACY_NUMBER_ARRAY (Go-To Club): si algún intento llega a scoreOf
export function leveledUpInSession(
  drill: DrillDef,
  data: AttemptsData,
): { leveledUp: boolean; reachedDistance: number | null } {
  if (!drill.hasLevelUp) return { leveledUp: false, reachedDistance: null };

  if (data.type === "STREAK_BY_DIST") {
    const target = drill.levelUpStreak ?? 10;
    let bestDist: number | null = null;
    for (const a of data.attempts) {
      if (a.streak >= target) {
        if (bestDist == null || a.distance > bestDist) bestDist = a.distance;
      }
    }
    return { leveledUp: bestDist != null, reachedDistance: bestDist };
  }

  if (data.type === "GO_TO_DIR") {
    const reached = data.attempts.some((a) => a.fw >= drill.scoreOf);
    return { leveledUp: reached, reachedDistance: null };
  }

  if (data.type === "LEGACY_NUMBER_ARRAY") {
    const reached = data.attempts.some((a) => a >= drill.scoreOf);
    return { leveledUp: reached, reachedDistance: null };
  }

  return { leveledUp: false, reachedDistance: null };
}

// ============ Legacy helpers (para Go-To Club + lecturas viejas) ============

export function setScore(scoring: ScoringMode, attempts: number[]): number | null {
  const valid = attempts.filter((a) => !isNaN(a));
  if (valid.length === 0) return null;
  if (scoring === "BEAT_BEST_LOWER_BY_1") {
    return valid.reduce((a, b) => a + b, 0);
  }
  return Math.max(...valid);
}

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
  return bestPrevious == null ? false : score <= bestPrevious - 1;
}

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
  let best = -Infinity;
  for (const set of pastSets) {
    for (const score of set) {
      if (score > best) best = score;
    }
  }
  return best === -Infinity ? null : best;
}
