// Tiger 5 — las 5 métricas más correlacionadas con score alto (DECADE).
// Todas se derivan de RoundHole.

export type Tiger5RoundMetrics = {
  threePutts: number;        // hoyos con 3+ putts
  doubleBogeys: number;      // hoyos con score - par >= 2
  parFiveBogeys: number;     // hoyos par 5 con score - par >= 1
  shortApproachBogeys: number; // hoyos con bogey desde <150 yds (proxy: distanceInRegYds < 150)
  doubleChips: number;       // hoyos con 2+ chips (proxy: strokesInsideSz >= 2 sin embocar 1-putt)
};

type HoleForTiger5 = {
  par: number;
  score: number | null;
  putts: number | null;
  distanceInRegYds: number | null;
  strokesInsideSz: number | null;
};

export function computeTiger5Round(holes: HoleForTiger5[]): Tiger5RoundMetrics {
  let threePutts = 0;
  let doubleBogeys = 0;
  let parFiveBogeys = 0;
  let shortApproachBogeys = 0;
  let doubleChips = 0;

  for (const h of holes) {
    if (h.putts != null && h.putts >= 3) threePutts++;
    if (h.score != null && h.score - h.par >= 2) doubleBogeys++;
    if (h.par === 5 && h.score != null && h.score - h.par >= 1) parFiveBogeys++;
    if (
      h.distanceInRegYds != null &&
      h.distanceInRegYds <= 150 &&
      h.score != null &&
      h.score - h.par >= 1
    ) {
      shortApproachBogeys++;
    }
    // Double chips proxy: strokesInsideSz >= 3 sugiere múltiples chips
    // (en SZ < 100 yds, con strokesInsideSz=3 normal hicieron 2 chips + 1 putt)
    if (h.strokesInsideSz != null && h.strokesInsideSz >= 3) doubleChips++;
  }

  return { threePutts, doubleBogeys, parFiveBogeys, shortApproachBogeys, doubleChips };
}

// Promedio del Tiger 5 sobre N rondas
export function avgTiger5(rounds: Tiger5RoundMetrics[]): Tiger5RoundMetrics {
  if (rounds.length === 0) {
    return {
      threePutts: 0,
      doubleBogeys: 0,
      parFiveBogeys: 0,
      shortApproachBogeys: 0,
      doubleChips: 0,
    };
  }
  const sum = rounds.reduce(
    (acc, r) => ({
      threePutts: acc.threePutts + r.threePutts,
      doubleBogeys: acc.doubleBogeys + r.doubleBogeys,
      parFiveBogeys: acc.parFiveBogeys + r.parFiveBogeys,
      shortApproachBogeys: acc.shortApproachBogeys + r.shortApproachBogeys,
      doubleChips: acc.doubleChips + r.doubleChips,
    }),
    { threePutts: 0, doubleBogeys: 0, parFiveBogeys: 0, shortApproachBogeys: 0, doubleChips: 0 },
  );
  const n = rounds.length;
  return {
    threePutts: sum.threePutts / n,
    doubleBogeys: sum.doubleBogeys / n,
    parFiveBogeys: sum.parFiveBogeys / n,
    shortApproachBogeys: sum.shortApproachBogeys / n,
    doubleChips: sum.doubleChips / n,
  };
}

export const TIGER5_LABELS: { key: keyof Tiger5RoundMetrics; label: string; hint: string }[] = [
  { key: "threePutts", label: "3-putts", hint: "Hoyos con 3+ putts" },
  { key: "doubleBogeys", label: "Doble bogeys", hint: "Hoyos con +2 o peor" },
  { key: "parFiveBogeys", label: "Bogeys par 5", hint: "Par 5 jugados +1 o peor" },
  { key: "shortApproachBogeys", label: "Bogeys <150 yds", hint: "Bogeys con approach corto" },
  { key: "doubleChips", label: "Double chips", hint: "Hoyos con 3+ golpes en SZ" },
];
