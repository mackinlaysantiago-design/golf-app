// "The Combine" — Skill Test Suite oficial de The Scoring Method.
// Constantes y scoring extraídos del bundle JS real de tsmcaddie.com (16/10/2026,
// ver docs/knowledge-base/14_tsm_caddie_competitor_analysis.md §3.1) — no del video
// de Circle.so, que describe la progresión del lag putt de forma imprecisa.

export type CombineTestType = "SHORT_PUTTS" | "LAG_PUTTS" | "CHIPPING" | "WEDGES" | "DRIVER";

export const COMBINE_ATTEMPTS = 10;

export const COMBINE_TEST_ORDER: CombineTestType[] = [
  "SHORT_PUTTS",
  "LAG_PUTTS",
  "CHIPPING",
  "WEDGES",
  "DRIVER",
];

export const COMBINE_LESSON_URL: Record<CombineTestType, string> = {
  SHORT_PUTTS: "https://the-scoring-method.circle.so/c/the-scoring-method-combine/sections/1205562/lessons/4635462",
  LAG_PUTTS: "https://the-scoring-method.circle.so/c/the-scoring-method-combine/sections/1205562/lessons/4635511",
  CHIPPING: "https://the-scoring-method.circle.so/c/the-scoring-method-combine/sections/1205562/lessons/4635515",
  WEDGES: "https://the-scoring-method.circle.so/c/the-scoring-method-combine/sections/1205562/lessons/4635520",
  DRIVER: "https://the-scoring-method.circle.so/c/the-scoring-method-combine/sections/1205562/lessons/4635522",
};

// ---------- 1. Short Putts ----------
export const PUTT_FEET = 4;
export const PUTT_POSITIONS = 5; // 5 posiciones, 2 vueltas = 10 putts

export type ShortPuttsData = { hits: boolean[] };

export function shortPuttsScore(d: ShortPuttsData): number {
  return d.hits.filter(Boolean).length;
}

// ---------- 2. Lag Putting ----------
export const LAG_CIRCLE_FEET = 4;
// Progresión real (confirmada en el bundle) — paso de 5ft, arranca en 15ft.
export const LAG_FEET = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export type LagPuttOutcome = "HOLED" | "INSIDE" | "OUTSIDE";
export type LagPuttsData = { outcomes: LagPuttOutcome[] };

export function lagPuttOutcomePoints(o: LagPuttOutcome): number {
  return o === "HOLED" ? 2 : o === "INSIDE" ? 1 : 0;
}

export function lagPuttsScore(d: LagPuttsData): number {
  return d.outcomes.reduce((s, o) => s + lagPuttOutcomePoints(o), 0);
}

// ---------- 3. Chipping ----------
export const CHIP_PACES = 25;
export type ChipStrokes = 1 | 2 | 3 | 4; // 4 = "4 or more"
export type ChippingData = { strokes: ChipStrokes[] };

export function chipStrokesPoints(n: ChipStrokes): number {
  return n === 1 ? 2 : n === 2 ? 1 : n === 3 ? 0.5 : 0;
}

export function chippingScore(d: ChippingData): number {
  return d.strokes.reduce((s, n) => s + chipStrokesPoints(n), 0);
}

// ---------- 4. Wedges ----------
// 50/75/100 × 3 vueltas = 9 shots. Shot 10 (índice 9) = elección del jugador entre
// esas 3 distancias — NO una distancia libre.
export const WEDGE_ROUND = [50, 75, 100];
export const WEDGE_WINDOW = 0.1;

export type WedgesData = { hits: boolean[]; shot10Distance: 50 | 75 | 100 };

export function wedgeTargetYds(attemptIndex: number, shot10Distance: 50 | 75 | 100): number {
  return attemptIndex < 9 ? WEDGE_ROUND[attemptIndex % 3] : shot10Distance;
}

export function wedgeWindow(targetYds: number): { lo: number; hi: number } {
  return { lo: targetYds * (1 - WEDGE_WINDOW), hi: targetYds * (1 + WEDGE_WINDOW) };
}

export function wedgesScore(d: WedgesData): number {
  return d.hits.filter(Boolean).length;
}

// ---------- 5. Driver ----------
export const DRIVER_FAIRWAY = 0.1;
export const DRIVER_YARDS_MIN = 150;
export const DRIVER_YARDS_MAX = 350;
export const DRIVER_YARDS_STEP = 5;
export const DRIVER_YARDS_DEFAULT = 250;

export type DriverData = { hits: boolean[]; carryYds: number };

export function fairwayHalfWidth(carryYds: number): number {
  return Math.round(carryYds * DRIVER_FAIRWAY);
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
  return 0;
}

/** "50 points in total" nominal — Lag Putting y Chipping pueden superar su nominal de
 * 10 si el jugador embocó mucho; no hay cap, así puntúa el protocolo oficial. */
export function totalScore(scores: Record<CombineTestType, number>): number {
  return COMBINE_TEST_ORDER.reduce((sum, t) => sum + (scores[t] ?? 0), 0);
}

export const COMBINE_NOMINAL_TOTAL = COMBINE_TEST_ORDER.length * 10;

// ---------- Copy de la pantalla CombineIntro (texto exacto del bundle real) ----------
export type ScoreBadge = { points: string; label: string };

export type IntroCopy = {
  label: string; // "Short Putts", "Lag Putting", ...
  reps: string; // "Putts", "Chips", "Shots", "Drives"
  setup: string;
  secondLabel: string; // "Play" | "Target"
  second: string;
  score: ScoreBadge[];
};

// El texto "Target" de la lección original siempre ejemplifica con la 1ra distancia
// de la ronda (50yds), sin importar qué eligió el jugador para el shot 10.
function wedgesIntro(): IntroCopy {
  const target = WEDGE_ROUND[0];
  const { lo, hi } = wedgeWindow(target);
  return {
    label: "Wedges",
    reps: "Shots",
    setup: `${WEDGE_ROUND.join(", ")}, then round again, three times. Shot 10 es tu elección entre las tres.`,
    secondLabel: "Target",
    second: `Adentro del 10% de la distancia. Desde ${target} yds, eso es ${lo.toFixed(1)} a ${hi.toFixed(1)}.`,
    score: [
      { points: "1", label: "Adentro de la ventana" },
      { points: "0", label: "Afuera" },
    ],
  };
}

function driverIntro(carryYds: number): IntroCopy {
  const half = fairwayHalfWidth(carryYds);
  return {
    label: "Driver",
    reps: "Drives",
    setup: "Solo driver. 10 tiros.",
    secondLabel: "Target",
    second: `Fairway = 10% de tu distancia a cada lado de tu línea. Pegándola ${carryYds}, tenés ${half} yds a la izquierda y ${half} a la derecha.`,
    score: [
      { points: "1", label: "Fairway" },
      { points: "0", label: "Afuera" },
    ],
  };
}

export const COMBINE_INTRO: Record<CombineTestType, IntroCopy> = {
  SHORT_PUTTS: {
    label: "Short Putts",
    reps: "Putts",
    setup: `5 posiciones alrededor del hoyo, cada una a ${PUTT_FEET} ft, en una pendiente leve (~1°).`,
    secondLabel: "Play",
    second: `Dale la vuelta a las 5 posiciones dos veces. ${COMBINE_ATTEMPTS} putts.`,
    score: [
      { points: "1", label: "Embocó" },
      { points: "0", label: "Falló" },
    ],
  },
  LAG_PUTTS: {
    label: "Lag Putting",
    reps: "Putts",
    setup: `El mismo círculo de ${LAG_CIRCLE_FEET} ft alrededor del hoyo es tu target.`,
    secondLabel: "Play",
    second: `Primer putt desde ${LAG_FEET[0]} ft. Cada putt siguiente retrocedé 5 ft: ${LAG_FEET.slice(0, 5).join(", ")} y así. ${COMBINE_ATTEMPTS} putts.`,
    score: [
      { points: "2", label: "Embocó" },
      { points: "1", label: `Adentro de ${LAG_CIRCLE_FEET} ft` },
      { points: "0", label: "Afuera" },
    ],
  },
  CHIPPING: {
    label: "Chipping",
    reps: "Chips",
    setup: `Una pelota, el palo que quieras. Chips simples desde alrededor del green, todos adentro de ${CHIP_PACES} pasos.`,
    secondLabel: "Play",
    second: `${COMBINE_ATTEMPTS} chips desde puntos distintos. Jugá cada uno hasta embocar.`,
    score: [
      { points: "2", label: "Chip-in" },
      { points: "1", label: "Down in 2" },
      { points: "½", label: "Down in 3" },
      { points: "0", label: "4 o más" },
    ],
  },
  // Placeholders — se resuelven con shot10Distance/carryYds reales al render.
  WEDGES: wedgesIntro(),
  DRIVER: driverIntro(DRIVER_YARDS_DEFAULT),
};

export { driverIntro };
