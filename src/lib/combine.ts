// "The Combine" — Skill Test Suite (ver docs/knowledge-base/04_roadmap.md P2#9 y
// docs/knowledge-base/14_tsm_caddie_competitor_analysis.md §3/§10).
// Protocolo FIJO de 5 tests, todos con el mismo # de intentos (10) y el mismo
// scoring (# de éxitos de 10) — a diferencia de PracticeDrill, que es práctica
// suelta sin protocolo comparable. Los targets de cada test salen de Player
// (onePuttCircleFt, twoPuttCircleYds, enterSzYds) para que el criterio de "éxito"
// sea el mismo que ya usa el resto de la app (scoring-method.ts).

export type CombineTestType = "SHORT_PUTTS" | "LAG_PUTTS" | "CHIPPING" | "WEDGES" | "DRIVER";

export const COMBINE_ATTEMPTS = 10;

// Sin target de fairway en Player todavía — ancho fijo del protocolo (±half width).
export const DRIVER_TARGET_HALF_WIDTH_YDS = 15;

export type PlayerTargets = {
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
  enterSzYds: number;
};

export type CombineTestDef = {
  type: CombineTestType;
  order: number;
  label: string;
  icon: string;
  /** Descripción de cómo ejecutar el test (instrucciones fijas del protocolo). */
  protocol: string;
  /** Criterio de éxito por intento, ya resuelto con los targets del Player. */
  successCriteria: (targets: PlayerTargets) => string;
};

export const COMBINE_TESTS: CombineTestDef[] = [
  {
    type: "SHORT_PUTTS",
    order: 1,
    label: "Short Putts",
    icon: "⛳",
    protocol: `${COMBINE_ATTEMPTS} putts cortos, misma distancia, uno por intento.`,
    successCriteria: (t) => `Embocar desde ${t.onePuttCircleFt} ft (1-Putt Circle)`,
  },
  {
    type: "LAG_PUTTS",
    order: 2,
    label: "Lag Putts",
    icon: "🎯",
    protocol: `${COMBINE_ATTEMPTS} lag putts largos, uno por intento.`,
    successCriteria: (t) =>
      `Dejarlo dentro del 1-Putt Circle (${t.onePuttCircleFt} ft) desde ${t.twoPuttCircleYds} yds`,
  },
  {
    type: "CHIPPING",
    order: 3,
    label: "Chipping",
    icon: "🪶",
    protocol: `${COMBINE_ATTEMPTS} chips desde afuera del green, uno por intento.`,
    successCriteria: (t) => `Dejarlo dentro del 1-Putt Circle (${t.onePuttCircleFt} ft)`,
  },
  {
    type: "WEDGES",
    order: 4,
    label: "Wedges",
    icon: "🏌️",
    protocol: `${COMBINE_ATTEMPTS} wedges desde adentro de la Scoring Zone, uno por intento.`,
    successCriteria: (t) =>
      `Dejarlo dentro del 2-Putt Circle (${t.twoPuttCircleYds} yds) desde ~${t.enterSzYds} yds`,
  },
  {
    type: "DRIVER",
    order: 5,
    label: "Driver",
    icon: "🚀",
    protocol: `${COMBINE_ATTEMPTS} drives al fairway, uno por intento.`,
    successCriteria: () =>
      `Aterrizar dentro de ±${DRIVER_TARGET_HALF_WIDTH_YDS} yds del centro del fairway`,
  },
];

export const COMBINE_TEST_BY_TYPE: Record<CombineTestType, CombineTestDef> = Object.fromEntries(
  COMBINE_TESTS.map((t) => [t.type, t]),
) as Record<CombineTestType, CombineTestDef>;

export function playerTargets(player: {
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
  enterSzYds: number;
}): PlayerTargets {
  return {
    onePuttCircleFt: player.onePuttCircleFt,
    twoPuttCircleYds: player.twoPuttCircleYds,
    enterSzYds: player.enterSzYds,
  };
}

/** Score de un test = # de intentos exitosos (0-10). */
export function scoreAttempts(attempts: boolean[]): number {
  return attempts.filter(Boolean).length;
}

/** Score total del Combine = suma de los 5 tests (0-50). */
export function totalScore(scores: Record<CombineTestType, number>): number {
  return COMBINE_TESTS.reduce((sum, t) => sum + (scores[t.type] ?? 0), 0);
}
