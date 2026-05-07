// The Scoring Method — Goals combinados (Gears del Level 2)
// Combinan distancia para Enter SZ + golpes desde SZ en un solo target progresivo.

export type SmGoal = {
  label: string;
  enterSzYds: number;
  downInSzStrokes: number;
  description: string;
};

export const GOAL_LADDER: SmGoal[] = [
  {
    label: "100/3",
    enterSzYds: 100,
    downInSzStrokes: 3,
    description: "Entrar a 100 yds y bajar en 3 — bogey golfer",
  },
  {
    label: "100/2",
    enterSzYds: 100,
    downInSzStrokes: 2,
    description: "Entrar a 100 yds y bajar en 2 — mid-handicap",
  },
  {
    label: "125/2",
    enterSzYds: 125,
    downInSzStrokes: 2,
    description: "Entrar a 125 yds y bajar en 2 — single-digit",
  },
  {
    label: "150/2",
    enterSzYds: 150,
    downInSzStrokes: 2,
    description: "Entrar a 150 yds y bajar en 2 — scratch",
  },
];

export function findGoalByConfig(
  enterSzYds: number,
  downInSzStrokes: number,
): SmGoal | null {
  return (
    GOAL_LADDER.find(
      (g) => g.enterSzYds === enterSzYds && g.downInSzStrokes === downInSzStrokes,
    ) ?? null
  );
}

export function findGoalByLabel(label: string): SmGoal | null {
  return GOAL_LADDER.find((g) => g.label === label) ?? null;
}

export function nextGoal(currentLabel: string): SmGoal | null {
  const idx = GOAL_LADDER.findIndex((g) => g.label === currentLabel);
  if (idx === -1) return null;
  return idx < GOAL_LADDER.length - 1 ? GOAL_LADDER[idx + 1] : null;
}

export function previousGoal(currentLabel: string): SmGoal | null {
  const idx = GOAL_LADDER.findIndex((g) => g.label === currentLabel);
  if (idx <= 0) return null;
  return GOAL_LADDER[idx - 1];
}

// Determina si un hoyo cumplió un goal específico (atómico: ambas condiciones)
export function holeAchievedGoal(
  goal: SmGoal,
  hole: { distanceInRegYds: number | null; strokesInsideSz: number | null },
): boolean | null {
  if (hole.distanceInRegYds == null || hole.strokesInsideSz == null) return null;
  const enteredSZ = hole.distanceInRegYds <= goal.enterSzYds;
  const downIn = hole.strokesInsideSz <= goal.downInSzStrokes;
  return enteredSZ && downIn;
}

// Tally de goals achieved en una serie de hoyos
export function tallyGoalsAchieved(
  goal: SmGoal,
  holes: { distanceInRegYds: number | null; strokesInsideSz: number | null }[],
): { achieved: number; attempted: number; pct: number } {
  let achieved = 0;
  let attempted = 0;
  for (const h of holes) {
    const r = holeAchievedGoal(goal, h);
    if (r === null) continue;
    attempted++;
    if (r) achieved++;
  }
  return {
    achieved,
    attempted,
    pct: attempted > 0 ? (achieved / attempted) * 100 : 0,
  };
}
