// The Scoring Method — Goals separados (Entry SZ + Down in SZ).
//
// Reemplaza el sistema viejo de "Gears combinados" (100/3, 100/2, 125/2, 150/2)
// que mezclaba 2 ejes en una sola escala. Ahora son 2 metas independientes:
//   - Entry SZ: qué tan cerca tenés que llegar al green con el aproach
//   - Down in SZ: cuántos golpes te tomás desde adentro de la SZ
//
// Label format: "ENTRY/DOWN" (ej "25/2", "GIR/2", "100/3", "GIR/1").
// Entry "0" → GIR (on green), se renderiza como "GIR" en el label.

export type SmGoal = {
  label: string; // "100/3" | "25/2" | "GIR/1" etc.
  enterSzYds: number; // 0=GIR, 25, 50, 100
  downInSzStrokes: number; // 1, 2, 3
  description: string;
};

const ENTRY_OPTIONS = [
  { value: 100, label: "100" },
  { value: 50, label: "50" },
  { value: 25, label: "25" },
  { value: 0, label: "GIR" },
] as const;

const DOWN_OPTIONS = [3, 2, 1] as const;

function entryLabel(yds: number): string {
  return yds === 0 ? "GIR" : String(yds);
}

function descFor(yds: number, down: number): string {
  const entry = yds === 0 ? "On green (GIR)" : `≤${yds} yds`;
  const downLabel =
    down === 1 ? "1 golpe (chip-in / birdie)" :
    down === 2 ? "2 golpes (up & down / par)" :
    "3 golpes (chip + 2 putts / bogey)";
  return `${entry} + ${downLabel}`;
}

/** Matriz completa 4×3 = 12 goals. Ordenado de más fácil a más difícil. */
export const GOAL_LADDER: SmGoal[] = (() => {
  const out: SmGoal[] = [];
  // Ordenado por dificultad creciente. Down=3 más fácil que down=2 que down=1.
  // Para mismo down: entry más permisivo (100) es más fácil que más estricto (GIR).
  for (const down of [3, 2, 1] as const) {
    for (const e of ENTRY_OPTIONS) {
      out.push({
        label: `${entryLabel(e.value)}/${down}`,
        enterSzYds: e.value,
        downInSzStrokes: down,
        description: descFor(e.value, down),
      });
    }
  }
  return out;
})();

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

// ============ Relax / Tighten por eje ============
// Sistema nuevo: para "bajar un cambio" recomendamos relajar UN solo eje
// (entry o down), no ambos. Permite ajuste fino.

/** Goal con entry MÁS permisivo (más yds), mismo down. Null si ya está en 100. */
export function relaxEntry(goal: SmGoal): SmGoal | null {
  if (goal.enterSzYds === 100) return null;
  const nextYds =
    goal.enterSzYds === 0 ? 25 :
    goal.enterSzYds === 25 ? 50 :
    goal.enterSzYds === 50 ? 100 : null;
  if (nextYds == null) return null;
  return findGoalByConfig(nextYds, goal.downInSzStrokes);
}

/** Goal con down MÁS permisivo (más golpes), mismo entry. Null si ya está en 3. */
export function relaxDown(goal: SmGoal): SmGoal | null {
  if (goal.downInSzStrokes === 3) return null;
  return findGoalByConfig(goal.enterSzYds, goal.downInSzStrokes + 1);
}

/** Goal con entry MÁS estricto, mismo down. Null si ya está en GIR. */
export function tightenEntry(goal: SmGoal): SmGoal | null {
  if (goal.enterSzYds === 0) return null;
  const nextYds =
    goal.enterSzYds === 100 ? 50 :
    goal.enterSzYds === 50 ? 25 :
    goal.enterSzYds === 25 ? 0 : null;
  if (nextYds == null) return null;
  return findGoalByConfig(nextYds, goal.downInSzStrokes);
}

/** Goal con down MÁS estricto, mismo entry. Null si ya está en 1. */
export function tightenDown(goal: SmGoal): SmGoal | null {
  if (goal.downInSzStrokes === 1) return null;
  return findGoalByConfig(goal.enterSzYds, goal.downInSzStrokes - 1);
}

// ============ Análisis hoyo ============

/** Determina si un hoyo cumplió un goal específico (atómico: ambas condiciones). */
export function holeAchievedGoal(
  goal: SmGoal,
  hole: { distanceInRegYds: number | null; strokesInsideSz: number | null },
): boolean | null {
  if (hole.distanceInRegYds == null || hole.strokesInsideSz == null) return null;
  const enteredSZ = hole.distanceInRegYds <= goal.enterSzYds;
  const downIn = hole.strokesInsideSz <= goal.downInSzStrokes;
  return enteredSZ && downIn;
}

/**
 * Diagnóstico granular: ¿qué eje falló?
 *   - ENTRY_FAIL: no llegó al threshold de entry
 *   - DOWN_FAIL: entró bien pero no bajó en los golpes esperados
 *   - BOTH_FAIL: falló ambos
 *   - OK: cumplió goal
 */
export function holeDiagnostic(
  goal: SmGoal,
  hole: { distanceInRegYds: number | null; strokesInsideSz: number | null },
): "OK" | "ENTRY_FAIL" | "DOWN_FAIL" | "BOTH_FAIL" | null {
  if (hole.distanceInRegYds == null || hole.strokesInsideSz == null) return null;
  const enteredSZ = hole.distanceInRegYds <= goal.enterSzYds;
  const downIn = hole.strokesInsideSz <= goal.downInSzStrokes;
  if (enteredSZ && downIn) return "OK";
  if (!enteredSZ && !downIn) return "BOTH_FAIL";
  if (!enteredSZ) return "ENTRY_FAIL";
  return "DOWN_FAIL";
}

/** Tally de goals achieved en una serie de hoyos. */
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

// ============ Compat: nextGoal/previousGoal (deprecated, mantengo para callers viejos) ============
// Estos eran del sistema viejo de gears combinados. Se mantienen por compat:
// devuelven el siguiente/anterior en GOAL_LADDER (que ahora es 4×3 = 12, no 4).
// Nuevos callers: usar relaxEntry/relaxDown/tightenEntry/tightenDown.

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

export { ENTRY_OPTIONS, DOWN_OPTIONS };
