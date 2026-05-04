// Niveles del Scoring Method por jugador. Cuando lográs perfect run en una
// ronda con la config actual, podés "subir" al siguiente (más estricto).

export type SmField =
  | "enterSzYds"
  | "downInSzStrokes"
  | "onePuttCircleFt"
  | "twoPuttCircleYds";

// Listas ordenadas de más fácil a más difícil
export const ENTER_SZ_LADDER = [100, 50, 25, 0]; // 0 = GIR
export const DOWN_IN_SZ_LADDER = [3, 2, 1];
export const ONE_PUTT_LADDER = [6, 5, 4, 3, 2];
export const TWO_PUTT_LADDER = [20, 15, 10, 5];

export const LADDERS: Record<SmField, number[]> = {
  enterSzYds: ENTER_SZ_LADDER,
  downInSzStrokes: DOWN_IN_SZ_LADDER,
  onePuttCircleFt: ONE_PUTT_LADDER,
  twoPuttCircleYds: TWO_PUTT_LADDER,
};

export const LABELS: Record<SmField, string> = {
  enterSzYds: "Enter SZ",
  downInSzStrokes: "Down in SZ",
  onePuttCircleFt: "1-Putt Circle",
  twoPuttCircleYds: "2-Putt Circle",
};

export const UNITS: Record<SmField, string> = {
  enterSzYds: "yds",
  downInSzStrokes: "golpes",
  onePuttCircleFt: "ft",
  twoPuttCircleYds: "yds",
};

// Devuelve el siguiente nivel (más estricto) — null si ya está al máximo
export function nextLevel(field: SmField, current: number): number | null {
  const ladder = LADDERS[field];
  const idx = ladder.indexOf(current);
  if (idx === -1) {
    // No está en el ladder canónico — buscamos el próximo más bajo
    const lower = ladder.filter((v) => v < current);
    return lower.length > 0 ? Math.max(...lower) : null;
  }
  return idx < ladder.length - 1 ? ladder[idx + 1] : null;
}

// Formato display del nivel (ej "GIR" en vez de "0" para enterSz)
export function formatLevel(field: SmField, value: number): string {
  if (field === "enterSzYds" && value === 0) return "GIR";
  return `${value} ${UNITS[field]}`;
}
