/**
 * Auto-fill de la Advanced Scorecard Level 2 desde Round + RoundHole.
 *
 * Toma una ronda con sus hoyos y deriva TODOS los campos del scorecard.
 * No requiere data extra del usuario — todo viene de lo que ya carga en
 * el RondaTracker (score, putts, firstPuttDistanceFt, strokesInsideSz, etc.)
 * + config de la ronda (enterSzYds, downInSzStrokes, onePuttCircleFt).
 */

import type { ScorecardData, ScorecardHole } from "./scorecard";

type ComputeInput = {
  round: {
    id: string;
    date: Date;
    enterSzYds: number; // 100 | 50 | 25
    downInSzStrokes: number; // 2 | 3
    onePuttCircleFt: number; // 4 | 6 | 8 | 10
    bestParts: string | null; // JSON array de strings
    bestShot: string | null;
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
    firstPuttDistanceFt: number | null;
    distanceInRegYds: number | null;
    strokesInsideSz: number | null;
    penaltyStrokes: number | null;
    keysBroken: unknown; // Json array of numbers
  }>;
};

const ENTER_SZ_LEVELS = ["100", "50", "25", "GIR"] as const;
type EnterSzLevel = "100" | "50" | "25" | "GIR" | "OUT";

function levelForDistance(d: number | null): EnterSzLevel | null {
  if (d == null) return null;
  if (d === 0) return "GIR";
  if (d <= 25) return "25";
  if (d <= 50) return "50";
  if (d <= 100) return "100";
  return "OUT";
}

function goalLevelFromYds(yds: number): "100" | "50" | "25" | "GIR" {
  if (yds <= 0) return "GIR";
  if (yds <= 25) return "25";
  if (yds <= 50) return "50";
  return "100";
}

function szShotsGoalFromConfig(enterSzYds: number, downInSz: number): ScorecardData["szShotsGoal"] {
  // El goal estándar es "100/3", "100/2", "125/2", "150/2". Mapeamos al más cercano.
  if (enterSzYds >= 150) return "150/2";
  if (enterSzYds >= 125) return "125/2";
  if (downInSz <= 2) return "100/2";
  return "100/3";
}

function clampShortPuttThreshold(v: number): 4 | 6 | 8 | 10 {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  if (v <= 8) return 8;
  return 10;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function sumNum(xs: (number | null | undefined)[]): number | null {
  const valid = xs.filter((x): x is number => typeof x === "number");
  return valid.length === 0 ? null : sum(valid);
}

export function computeScorecardFromRound(input: ComputeInput): ScorecardData {
  const { round, playerName, yardage, par, holes } = input;
  const threshold = clampShortPuttThreshold(round.onePuttCircleFt);
  const enterSzGoal = goalLevelFromYds(round.enterSzYds);
  const goalIdx = ENTER_SZ_LEVELS.indexOf(enterSzGoal);

  // Padding a 18 hoyos
  const holesPadded: ComputeInput["holes"] = Array.from({ length: 18 }, (_, i) => {
    const n = i + 1;
    return (
      holes.find((h) => h.holeNumber === n) ?? {
        holeNumber: n,
        par: 4,
        score: null,
        putts: null,
        firstPuttDistanceFt: null,
        distanceInRegYds: null,
        strokesInsideSz: null,
        penaltyStrokes: null,
        keysBroken: null,
      }
    );
  });

  // Mapeo de hoyos
  const mappedHoles: ScorecardHole[] = holesPadded.map((h) => {
    const enterSzLevel = levelForDistance(h.distanceInRegYds);
    return {
      holeNumber: h.holeNumber,
      par: h.par ?? null,
      score: h.score,
      enterSzYds: h.distanceInRegYds,
      enterSzLevel,
      firstPuttFt: h.firstPuttDistanceFt,
      szShots: h.strokesInsideSz,
      szGoalAchieved:
        h.strokesInsideSz != null ? h.strokesInsideSz <= round.downInSzStrokes : null,
      totalPutts: h.putts,
      shortPuttAttempted:
        h.firstPuttDistanceFt != null && h.firstPuttDistanceFt <= threshold,
      shortPuttMade:
        h.firstPuttDistanceFt != null && h.firstPuttDistanceFt <= threshold && h.putts === 1,
    };
  });

  // ============ TOTALES ============
  const front = mappedHoles.slice(0, 9);
  const back = mappedHoles.slice(9, 18);
  const scoreOut = sumNum(front.map((h) => h.score));
  const scoreIn = sumNum(back.map((h) => h.score));
  const scoreTotal = scoreOut != null && scoreIn != null ? scoreOut + scoreIn : (scoreOut ?? scoreIn);
  const puttsOut = sumNum(front.map((h) => h.totalPutts));
  const puttsIn = sumNum(back.map((h) => h.totalPutts));
  const puttsTotal = puttsOut != null && puttsIn != null ? puttsOut + puttsIn : (puttsOut ?? puttsIn);

  // Enter SZ count (checks): hoyos donde el level achieved es al menos el goal
  const countEnterSzCheck = (hs: ScorecardHole[]) =>
    hs.filter((h) => {
      if (h.enterSzLevel == null || h.enterSzLevel === "OUT") return false;
      const achievedIdx = ENTER_SZ_LEVELS.indexOf(h.enterSzLevel);
      return achievedIdx >= goalIdx;
    }).length;
  const enterSzOutCount = countEnterSzCheck(front);
  const enterSzInCount = countEnterSzCheck(back);

  // SZ shots count (checks): hoyos donde alcanzó su goal de down in SZ
  const countSzCheck = (hs: ScorecardHole[]) =>
    hs.filter((h) => h.szGoalAchieved === true).length;
  const szShotsOutCount = countSzCheck(front);
  const szShotsInCount = countSzCheck(back);

  // ============ PUTT BUCKETS (made/attempts) ============
  const buckets = { b03: { m: 0, a: 0 }, b36: { m: 0, a: 0 }, b610: { m: 0, a: 0 } };
  for (const h of mappedHoles) {
    if (h.firstPuttFt == null) continue;
    const d = h.firstPuttFt;
    const made = h.totalPutts === 1;
    if (d <= 3) {
      buckets.b03.a++;
      if (made) buckets.b03.m++;
    } else if (d <= 6) {
      buckets.b36.a++;
      if (made) buckets.b36.m++;
    } else if (d <= 10) {
      buckets.b610.a++;
      if (made) buckets.b610.m++;
    }
  }

  // ============ 10 KEYS TALLY ============
  const keys = {
    missedShortPutts: 0,
    penaltyStrokes: 0,
    notOutOfTrouble: 0,
    threePutts: 0,
    underClubbing: 0,
    riskyShots: 0,
    shortSiding: 0,
    holdingBadShots: 0,
    misreadingLie: 0,
    startingPoorly: 0,
  };
  for (const h of holesPadded) {
    // Penalty strokes: contar 1 por hoyo donde hubo penalty
    if ((h.penaltyStrokes ?? 0) > 0) keys.penaltyStrokes++;
    // 3 putts: contar 1 por hoyo con 3+ putts
    if ((h.putts ?? 0) >= 3) keys.threePutts++;
    // Missed short putts: 1er putt <= threshold y no embocó
    if (
      h.firstPuttDistanceFt != null &&
      h.firstPuttDistanceFt <= threshold &&
      (h.putts ?? 0) > 1
    ) {
      keys.missedShortPutts++;
    }
    // Las demás keys vienen de RoundHole.keysBroken (array de números 1-10)
    if (Array.isArray(h.keysBroken)) {
      for (const n of h.keysBroken as number[]) {
        switch (n) {
          case 3: keys.notOutOfTrouble++; break;
          case 5: keys.underClubbing++; break;
          case 6: keys.riskyShots++; break;
          case 7: keys.shortSiding++; break;
          case 8: keys.holdingBadShots++; break;
          case 9: keys.misreadingLie++; break;
          case 10: keys.startingPoorly++; break;
          // 1 (missed short putts), 2 (penalty), 4 (3 putts) ya se derivaron arriba
        }
      }
    }
  }
  // Starting poorly automático: si hizo +1 vs par o peor en los primeros 3
  if (keys.startingPoorly === 0) {
    const first3 = mappedHoles.slice(0, 3);
    const overPar = first3.reduce(
      (s, h) => s + (h.score != null && h.par != null ? Math.max(0, h.score - h.par) : 0),
      0,
    );
    if (overPar >= 3) keys.startingPoorly = 1; // heurística simple
  }

  // ============ ENTERING SZ / DOWN SZ / PROXY ============
  const enterSzCounts = { over100: 0, at100: 0, at50: 0, at25: 0, gir: 0 };
  const proxyAccum = { p100: [] as number[], p50: [] as number[], p25: [] as number[], pGir: [] as number[] };
  for (const h of holesPadded) {
    const d = h.distanceInRegYds;
    if (d == null) continue;
    const fp = h.firstPuttDistanceFt;
    if (d === 0) {
      enterSzCounts.gir++;
      if (fp != null) proxyAccum.pGir.push(fp);
    } else if (d <= 25) {
      enterSzCounts.at25++;
      if (fp != null) proxyAccum.p25.push(fp);
    } else if (d <= 50) {
      enterSzCounts.at50++;
      if (fp != null) proxyAccum.p50.push(fp);
    } else if (d <= 100) {
      enterSzCounts.at100++;
      if (fp != null) proxyAccum.p100.push(fp);
    } else {
      enterSzCounts.over100++;
    }
  }
  const avg = (xs: number[]) => (xs.length === 0 ? null : Math.round(sum(xs) / xs.length));

  const downSzCounts = { over5: 0, at4: 0, at3: 0, at2: 0, at1: 0 };
  for (const h of holesPadded) {
    const s = h.strokesInsideSz;
    if (s == null) continue;
    if (s >= 5) downSzCounts.over5++;
    else if (s === 4) downSzCounts.at4++;
    else if (s === 3) downSzCounts.at3++;
    else if (s === 2) downSzCounts.at2++;
    else if (s === 1) downSzCounts.at1++;
    // s === 0 (hole-out) no se cuenta en estos buckets
  }

  // ============ BEST PARTS / BEST SHOT ============
  let bestParts: [string, string, string] = ["", "", ""];
  if (round.bestParts) {
    try {
      const parsed = JSON.parse(round.bestParts);
      if (Array.isArray(parsed)) {
        bestParts = [parsed[0] ?? "", parsed[1] ?? "", parsed[2] ?? ""];
      }
    } catch {
      // si no es JSON válido, tratamos como texto plano en la primera línea
      bestParts = [round.bestParts, "", ""];
    }
  }

  return {
    playerName,
    date: formatDate(round.date),
    course: round.course.name,
    yardage,
    par,
    enterSzGoal,
    szShotsGoal: szShotsGoalFromConfig(round.enterSzYds, round.downInSzStrokes),
    shortPuttThresholdFt: threshold,
    holes: mappedHoles,
    scoreOut,
    scoreIn,
    scoreTotal,
    puttsOut,
    puttsIn,
    puttsTotal,
    enterSzOutCount,
    enterSzInCount,
    enterSzTotalCount: enterSzOutCount + enterSzInCount,
    szShotsOutCount,
    szShotsInCount,
    szShotsTotalCount: szShotsOutCount + szShotsInCount,
    puttsMade0to3: buckets.b03.m,
    puttsAttempts0to3: buckets.b03.a,
    puttsMade3to6: buckets.b36.m,
    puttsAttempts3to6: buckets.b36.a,
    puttsMade6to10: buckets.b610.m,
    puttsAttempts6to10: buckets.b610.a,
    keys,
    enterSzCounts,
    proxy: {
      from100Ft: avg(proxyAccum.p100),
      from50Ft: avg(proxyAccum.p50),
      from25Ft: avg(proxyAccum.p25),
      fromGirFt: avg(proxyAccum.pGir),
    },
    downSzCounts,
    bestParts,
    bestShotDescription: round.bestShot ?? "",
  };
}
