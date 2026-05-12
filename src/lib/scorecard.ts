/**
 * Shape de datos para la TSM Advanced Scorecard Level 2.
 * Referencia: docs/knowledge-base/resources/advanced_scorecard_level_2.pdf
 *
 * Es una scorecard wide horizontal con 18 hoyos + subtotales OUT/IN/TOTAL.
 * 8 filas de data por hoyo + bottom panel con 10 keys + concentric circles.
 */

/** Datos por hoyo. Todos opcionales — la card muestra "—" si null. */
export type ScorecardHole = {
  holeNumber: number; // 1-18
  par: number | null;
  score: number | null;
  enterSzYds: number | null; // distance from flag when entered SZ (yds)
  enterSzLevel: "100" | "50" | "25" | "GIR" | "OUT" | null; // qué level achievó (OUT = outside 100)
  firstPuttFt: number | null; // length of 1st putt in feet
  szShots: number | null; // strokes inside SZ
  szGoalAchieved: boolean | null; // ¿cumplió su goal (100/3, 100/2, etc.)?
  totalPutts: number | null;
  shortPuttMade: boolean | null; // hizo el putt corto desde su threshold (4'/6'/8'/10')
  shortPuttAttempted: boolean | null; // intentó un putt < threshold
};

export type ScorecardData = {
  // Header
  playerName: string;
  date: string; // "DD/MM/YY"
  course: string;
  yardage: number | null;
  par: number | null;

  // Player config (la "level" elegida y threshold)
  enterSzGoal: "100" | "50" | "25" | "GIR"; // su goal para entrar a SZ
  szShotsGoal: "100/3" | "100/2" | "125/2" | "150/2"; // su goal para down in SZ
  shortPuttThresholdFt: 4 | 6 | 8 | 10; // su threshold de "putts cortos"

  // 18 holes
  holes: ScorecardHole[];

  // Totals (calculados pero los pasamos pre-computed para evitar duplicar lógica)
  scoreOut: number | null; // front 9
  scoreIn: number | null; // back 9
  scoreTotal: number | null;
  puttsOut: number | null;
  puttsIn: number | null;
  puttsTotal: number | null;
  enterSzOutCount: number | null;
  enterSzInCount: number | null;
  enterSzTotalCount: number | null;
  szShotsOutCount: number | null;
  szShotsInCount: number | null;
  szShotsTotalCount: number | null;

  // Putts made/attempts por bucket (sólo para la última fila)
  puttsMade0to3: number;
  puttsAttempts0to3: number;
  puttsMade3to6: number;
  puttsAttempts3to6: number;
  puttsMade6to10: number;
  puttsAttempts6to10: number;

  // 10 Keys to Scoring tally
  keys: {
    missedShortPutts: number; // 1
    penaltyStrokes: number; // 2
    notOutOfTrouble: number; // 3
    threePutts: number; // 4
    underClubbing: number; // 5
    riskyShots: number; // 6
    shortSiding: number; // 7
    holdingBadShots: number; // 8
    misreadingLie: number; // 9
    startingPoorly: number; // 10
  };

  // Bottom-right panels: ENTERING SZ + DOWN SZ + PROXY
  enterSzCounts: {
    over100: number; // >100 (rojo)
    at100: number; // 100
    at50: number;
    at25: number;
    gir: number;
  };
  proxy: {
    from100Ft: number | null;
    from50Ft: number | null;
    from25Ft: number | null;
    fromGirFt: number | null;
  };
  downSzCounts: {
    over5: number; // >5 (rojo)
    at4: number;
    at3: number;
    at2: number;
    at1: number;
  };

  // Back page (página 2)
  bestParts: [string, string, string]; // 3 lines
  bestShotDescription: string;
};

/** Datos de ejemplo realistas para preview. Ronda de 82 en La Lucila. */
export const SAMPLE_SCORECARD_DATA: ScorecardData = {
  playerName: "Santiago Mackinlay",
  date: "12/05/26",
  course: "La Lucila Country Club",
  yardage: 6248,
  par: 72,
  enterSzGoal: "50",
  szShotsGoal: "100/3",
  shortPuttThresholdFt: 6,

  holes: Array.from({ length: 18 }, (_, i) => {
    const n = i + 1;
    // Sample patterns por hoyo (mezcla realista para que el preview muestre
    // todos los casos: GIRs, putts cortos hechos y errados, etc.)
    const par = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 5, 3, 4][i];
    const scores = [5, 4, 4, 6, 4, 5, 3, 5, 5, 4, 5, 4, 4, 4, 5, 6, 3, 5];
    const enterDists: (number | null)[] = [50, 25, null, 75, 0, 50, null, 50, 0, 25, 50, null, 25, 0, 50, 75, null, 50];
    const levels: ("100" | "50" | "25" | "GIR" | "OUT" | null)[] = [
      "50", "25", "GIR", "100", "GIR", "50", "GIR", "50", "GIR",
      "25", "50", "GIR", "25", "GIR", "50", "100", "GIR", "50",
    ];
    // Mezcla de putts cortos y largos para que se vea la fila PUTTS < 6'
    const firstPutts = [5, 4, 6, 14, 3, 6, 2, 4, 12, 3, 18, 5, 6, 2, 22, 14, 3, 5];
    const puttsArr =  [2, 1, 1,  2, 2, 1, 1, 2,  2, 1,  2, 1, 1, 1,  2,  2, 1, 1];
    const szShotsArr = [3, 2, 1, 3, 2, 3, 1, 3, 2, 2, 3, 2, 2, 2, 3, 3, 1, 3];
    const threshold = 6;
    const firstPutt = firstPutts[i];
    const putts = puttsArr[i];
    return {
      holeNumber: n,
      par,
      score: scores[i],
      enterSzYds: enterDists[i] ?? null,
      enterSzLevel: levels[i],
      firstPuttFt: firstPutt,
      szShots: szShotsArr[i],
      szGoalAchieved: szShotsArr[i] <= 3,
      totalPutts: putts,
      // Putt corto = primer putt ≤ threshold; made si lo emboca en 1 (putts === 1)
      shortPuttAttempted: firstPutt <= threshold,
      shortPuttMade: firstPutt <= threshold && putts === 1,
    };
  }),

  scoreOut: 41,
  scoreIn: 41,
  scoreTotal: 82,
  puttsOut: 15,
  puttsIn: 18,
  puttsTotal: 33,
  enterSzOutCount: 7,
  enterSzInCount: 8,
  enterSzTotalCount: 15,
  szShotsOutCount: 5,
  szShotsInCount: 6,
  szShotsTotalCount: 11,

  puttsMade0to3: 5,
  puttsAttempts0to3: 6,
  puttsMade3to6: 3,
  puttsAttempts3to6: 7,
  puttsMade6to10: 1,
  puttsAttempts6to10: 5,

  keys: {
    missedShortPutts: 1,
    penaltyStrokes: 1,
    notOutOfTrouble: 0,
    threePutts: 2,
    underClubbing: 3,
    riskyShots: 2,
    shortSiding: 1,
    holdingBadShots: 0,
    misreadingLie: 1,
    startingPoorly: 1,
  },

  enterSzCounts: {
    over100: 3,
    at100: 4,
    at50: 6,
    at25: 3,
    gir: 5,
  },
  proxy: {
    from100Ft: 19,
    from50Ft: 14,
    from25Ft: 8,
    fromGirFt: 22,
  },
  downSzCounts: {
    over5: 0,
    at4: 1,
    at3: 5,
    at2: 9,
    at1: 2,
  },

  bestParts: [
    "Birdie en el 14 desde 15 ft",
    "Up & down desde bunker en el 5",
    "Drive perfecto al 18 después de doble en el 17",
  ],
  bestShotDescription:
    "Wedge desde 75 yds al 14 — solté el shot completo, sin pensar en el score, y quedó a 4 ft del banderín.",
};
