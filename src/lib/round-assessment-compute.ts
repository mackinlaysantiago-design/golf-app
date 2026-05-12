/**
 * Auto-fill del Round Assessment Card desde Round + RoundHole.
 *
 * Toma una ronda con sus hoyos y deriva todos los campos numéricos del
 * card (counts, averages, breakdowns). Los campos texto/% libres quedan
 * vacíos para que el jugador los complete.
 *
 * El helper NO toca la DB — solo computa. La merge con datos guardados
 * (`RoundAssessmentCard`) se hace en el endpoint.
 */

import type { AssessmentCardData } from "./round-assessment";

type ComputeInput = {
  round: {
    id: string;
    date: Date;
    holesPlayed: number;
    nineWhich: string | null;
    enterSzYds: number;
    downInSzStrokes: number;
    firstThreeStrokes: number | null;
    lastThreeStrokes: number | null;
    front9Strokes: number | null;
    back9Strokes: number | null;
    course: { name: string };
  };
  playerName: string;
  yardage: number | null;
  par: number | null;
  holes: Array<{
    holeNumber: number;
    par: number;
    score: number | null;
    putts: number | null;
    strokesToEnterSz: number | null;
    distanceInRegYds: number | null;
    strokesInsideSz: number | null;
    firstPuttDistanceFt: number | null;
    puttsInside1PuttCircle: number | null;
    penaltyStrokes: number | null;
    bunkerShots: number | null;
    bunkerUpAndDown: boolean | null;
  }>;
};

export type ComputedAssessment = Pick<
  AssessmentCardData,
  | "playerName"
  | "date"
  | "course"
  | "yardage"
  | "par"
  | "enterSz100Y"
  | "enterSz50Y"
  | "enterSz25Y"
  | "enterSzGIR"
  | "penalties"
  | "x100"
  | "proximityFromGirFt"
  | "proximityFrom25YFt"
  | "proximityFrom50YFt"
  | "proximityFrom100YFt"
  | "downInSz"
  | "par5Avg"
  | "par4Avg"
  | "par3Avg"
  | "score"
  | "eagles"
  | "birdies"
  | "pars"
  | "bogeys"
  | "doubleBogeys"
  | "others"
  | "firstThree"
  | "lastThree"
  | "front9"
  | "back9"
  | "bunkerShotsTotal"
  | "bunkerShotsUpAndDown"
  | "greenSideUpDownAttempts"
  | "greenSideUpDownMade"
  | "totalPutts"
  | "total3Putts"
  | "puttsMade0to3"
  | "puttsAttempts0to3"
  | "puttsMade3to6"
  | "puttsAttempts3to6"
  | "puttsMade6to10"
  | "puttsAttempts6to10"
>;

export function computeAssessmentFromRound(input: ComputeInput): ComputedAssessment {
  const { round, playerName, yardage, par, holes } = input;
  const played = holes.filter((h) => h.score != null && h.score > 0);

  // ============ HEADER ============
  const date = formatDate(round.date);

  // ============ C — ENTERING THE SCORING ZONE ============
  let enterSz100Y = 0,
    enterSz50Y = 0,
    enterSz25Y = 0,
    enterSzGIR = 0;
  const proxAccum = { gir: [] as number[], y25: [] as number[], y50: [] as number[], y100: [] as number[] };
  for (const h of played) {
    if (h.distanceInRegYds == null) continue;
    const d = h.distanceInRegYds;
    if (d === 0) {
      enterSzGIR++;
      if (h.firstPuttDistanceFt != null) proxAccum.gir.push(h.firstPuttDistanceFt);
    } else if (d <= 25) {
      enterSz25Y++;
      if (h.firstPuttDistanceFt != null) proxAccum.y25.push(h.firstPuttDistanceFt);
    } else if (d <= 50) {
      enterSz50Y++;
      if (h.firstPuttDistanceFt != null) proxAccum.y50.push(h.firstPuttDistanceFt);
    } else if (d <= 100) {
      enterSz100Y++;
      if (h.firstPuttDistanceFt != null) proxAccum.y100.push(h.firstPuttDistanceFt);
    }
  }
  const penalties = played.reduce((s, h) => s + (h.penaltyStrokes ?? 0), 0);

  // ============ D — DOWN IN THE SCORING ZONE (histograma 0-5) ============
  const downInSz: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  for (const h of played) {
    if (h.strokesInsideSz == null) continue;
    const s = h.strokesInsideSz;
    const idx = Math.min(Math.max(s, 0), 5);
    downInSz[idx] = (downInSz[idx] ?? 0) + 1;
  }

  // ============ E — PAR BREAKDOWN (avg shots por tipo) ============
  const par5 = played.filter((h) => h.par === 5);
  const par4 = played.filter((h) => h.par === 4);
  const par3 = played.filter((h) => h.par === 3);
  const par5Avg = par5.length > 0 ? sum(par5.map((h) => h.score ?? 0)) / par5.length : null;
  const par4Avg = par4.length > 0 ? sum(par4.map((h) => h.score ?? 0)) / par4.length : null;
  const par3Avg = par3.length > 0 ? sum(par3.map((h) => h.score ?? 0)) / par3.length : null;

  // ============ F — SCORE BREAKDOWN ============
  const score = played.length > 0 ? sum(played.map((h) => h.score ?? 0)) : null;
  let eagles = 0,
    birdies = 0,
    pars = 0,
    bogeys = 0,
    doubleBogeys = 0,
    others = 0;
  for (const h of played) {
    const delta = (h.score ?? 0) - h.par;
    if (delta <= -2) eagles++;
    else if (delta === -1) birdies++;
    else if (delta === 0) pars++;
    else if (delta === 1) bogeys++;
    else if (delta === 2) doubleBogeys++;
    else others++;
  }

  // First 3 / Last 3 / Front 9 / Back 9 — preferir el cached en Round, fallback a compute
  const firstThree = round.firstThreeStrokes ?? computeFirstThree(played);
  const lastThree = round.lastThreeStrokes ?? computeLastThree(played);
  const front9 = round.front9Strokes ?? computeRange(played, 1, 9);
  const back9 = round.back9Strokes ?? computeRange(played, 10, 18);

  // ============ G — STATS ============
  const bunkerShotsTotal = played.reduce((s, h) => s + (h.bunkerShots ?? 0), 0);
  const bunkerShotsUpAndDown = played.filter((h) => h.bunkerUpAndDown === true).length;

  // Greenside Up & Down: hoyo donde NO GIR + se terminó en strokesInsideSz <= 2 (chip + 1 putt)
  // attempts = todos los hoyos donde NO GIR (tuvo que chip/pitch desde fuera del green)
  // made = de esos, los que terminaron en 2 strokes inside SZ
  const gsAttempts = played.filter(
    (h) => h.distanceInRegYds != null && h.distanceInRegYds > 0 && h.strokesInsideSz != null,
  );
  const greenSideUpDownAttempts = gsAttempts.length;
  const greenSideUpDownMade = gsAttempts.filter((h) => (h.strokesInsideSz ?? 99) <= 2).length;

  const totalPutts = played.reduce((s, h) => s + (h.putts ?? 0), 0);
  const total3Putts = played.filter((h) => (h.putts ?? 0) >= 3).length;

  // Putt distance buckets (0-3, 3-6, 6-10 ft) — desde firstPuttDistanceFt
  // Made = putts === 1 (embocó al primer intento)
  const bucketsAttempts = { b0_3: 0, b3_6: 0, b6_10: 0 };
  const bucketsMade = { b0_3: 0, b3_6: 0, b6_10: 0 };
  for (const h of played) {
    if (h.firstPuttDistanceFt == null) continue;
    const d = h.firstPuttDistanceFt;
    const made = h.putts === 1;
    if (d <= 3) {
      bucketsAttempts.b0_3++;
      if (made) bucketsMade.b0_3++;
    } else if (d <= 6) {
      bucketsAttempts.b3_6++;
      if (made) bucketsMade.b3_6++;
    } else if (d <= 10) {
      bucketsAttempts.b6_10++;
      if (made) bucketsMade.b6_10++;
    }
  }

  return {
    playerName,
    date,
    course: round.course.name,
    yardage,
    par,

    // C — Entering SZ
    enterSz100Y,
    enterSz50Y,
    enterSz25Y,
    enterSzGIR,
    x100: null, // ambiguo en el PDF — el jugador lo completa si quiere
    penalties,
    proximityFromGirFt: avg(proxAccum.gir),
    proximityFrom25YFt: avg(proxAccum.y25),
    proximityFrom50YFt: avg(proxAccum.y50),
    proximityFrom100YFt: avg(proxAccum.y100),

    // D — Down in SZ
    downInSz,

    // E — Par breakdown
    par5Avg: par5Avg != null ? round2(par5Avg) : null,
    par4Avg: par4Avg != null ? round2(par4Avg) : null,
    par3Avg: par3Avg != null ? round2(par3Avg) : null,

    // F — Score breakdown
    score,
    eagles,
    birdies,
    pars,
    bogeys,
    doubleBogeys,
    others,
    firstThree,
    lastThree,
    front9,
    back9,

    // G — Stats
    bunkerShotsTotal,
    bunkerShotsUpAndDown,
    greenSideUpDownAttempts,
    greenSideUpDownMade,
    totalPutts,
    total3Putts,
    puttsMade0to3: bucketsMade.b0_3,
    puttsAttempts0to3: bucketsAttempts.b0_3,
    puttsMade3to6: bucketsMade.b3_6,
    puttsAttempts3to6: bucketsAttempts.b3_6,
    puttsMade6to10: bucketsMade.b6_10,
    puttsAttempts6to10: bucketsAttempts.b6_10,
  };
}

// ============ Helpers ============

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function avg(xs: number[]): number | null {
  return xs.length > 0 ? round1(sum(xs) / xs.length) : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function computeFirstThree(played: { holeNumber: number; score: number | null }[]): number | null {
  return computeRange(played, 1, 3);
}

function computeLastThree(played: { holeNumber: number; score: number | null }[]): number | null {
  // Si jugó 18, last 3 son hoyos 16-18; si jugó 9, son 7-9
  const maxHole = Math.max(...played.map((h) => h.holeNumber));
  return computeRange(played, maxHole - 2, maxHole);
}

function computeRange(
  played: { holeNumber: number; score: number | null }[],
  from: number,
  to: number,
): number | null {
  const range = played.filter((h) => h.holeNumber >= from && h.holeNumber <= to);
  if (range.length === 0) return null;
  return sum(range.map((h) => h.score ?? 0));
}

// ============ Merge auto-computed + user-entered ============

/**
 * Recibe el auto-compute + los campos guardados por el usuario y devuelve
 * la AssessmentCardData completa para renderear el card.
 *
 * Los campos numéricos siempre vienen del auto-compute (canonical).
 * Los campos texto/% vienen del usuario (si guardó algo); sino quedan vacíos.
 */
export function mergeAssessmentData(
  computed: ComputedAssessment,
  saved: Partial<AssessmentCardData> | null,
): AssessmentCardData {
  return {
    ...computed,
    // A — Pre Round Prep (defaults a false si no guardó)
    practiceRound: saved?.practiceRound ?? false,
    yardageBook: saved?.yardageBook ?? false,
    writtenPlan: saved?.writtenPlan ?? false,
    personalParDefined: saved?.personalParDefined ?? false,
    // B — Prep That Day
    warmUp: saved?.warmUp ?? "",
    mentalFocus: saved?.mentalFocus ?? "",
    // H — Best Part
    bestPartOfRound: saved?.bestPartOfRound ?? "",
    // I — Self Assessment %
    mentalStrengthPct: saved?.mentalStrengthPct ?? null,
    positiveSelfTalkPct: saved?.positiveSelfTalkPct ?? null,
    fortitudePct: saved?.fortitudePct ?? null,
    shotSelectionPct: saved?.shotSelectionPct ?? null,
    shotExecutionPct: saved?.shotExecutionPct ?? null,
    // J — Skill Sets
    skillUnder10Putts: saved?.skillUnder10Putts ?? "",
    skillLagPutts: saved?.skillLagPutts ?? "",
    skillChippingProx: saved?.skillChippingProx ?? "",
    skillWedgesProx: saved?.skillWedgesProx ?? "",
    skillBallStriking: saved?.skillBallStriking ?? "",
    skillGoToClub: saved?.skillGoToClub ?? "",
    // K — Lessons Learned
    lessonsLearned: saved?.lessonsLearned ?? "",
  };
}
