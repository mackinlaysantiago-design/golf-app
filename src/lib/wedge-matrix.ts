// Lógica del módulo Wedge Matrix (wedge gapping) — The Scoring Method, doc KB 13.
// La matriz son distancias conocidas = wedge × posición de swing.
// El carry (no el total) es lo que se mapea. KPI rey de una celda = dispersión (max-min).

export const WEDGES = [
  { key: "PW", label: "PW" },
  { key: "GW", label: "GW" },
  { key: "SW", label: "SW" },
  { key: "LW", label: "LW" },
] as const;

export const SWING_POSITIONS = [
  { key: "PITCH", label: "Pitch", pct: "~30%", hint: "palo paralelo al piso" },
  { key: "HALF", label: "Half", pct: "50%", hint: "manos al pecho" },
  { key: "THREE_QUARTER", label: "¾", pct: "75%", hint: "hasta el hombro" },
  { key: "FULL", label: "Full", pct: "100%", hint: "swing completo" },
] as const;

export type WedgeKey = (typeof WEDGES)[number]["key"];
export type SwingKey = (typeof SWING_POSITIONS)[number]["key"];

export function cellKey(wedge: string, swing: string) {
  return `${wedge}__${swing}`;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Sugiere qué carries marcar como outlier (chunk/skull) — el usuario después decide.
// Criterio: lejos de la mediana (MAD robusto) o un chunk muy corto (<75% de la mediana).
export function suggestOutliers(carries: number[]): boolean[] {
  if (carries.length < 4) return carries.map(() => false);
  const med = median(carries);
  const mad = median(carries.map((c) => Math.abs(c - med))) || 1;
  const farLimit = Math.max(10, 3 * mad); // yds
  return carries.map((c) => Math.abs(c - med) > farLimit || c < med * 0.75);
}

export type CellStats = {
  n: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  dispersion: number | null;
  lockedIn: boolean;
};

// Calcula la celda a partir de los carries CONSERVADOS (sin outliers).
// lockedIn = al menos 8 tiros y dispersión dentro del goal (default 4 yds).
export function computeCell(keptCarries: number[], goal = 4): CellStats {
  const n = keptCarries.length;
  if (n === 0) return { n: 0, avg: null, min: null, max: null, dispersion: null, lockedIn: false };
  const min = Math.min(...keptCarries);
  const max = Math.max(...keptCarries);
  const avg = keptCarries.reduce((a, b) => a + b, 0) / n;
  const dispersion = max - min;
  return {
    n,
    avg: Math.round(avg * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    dispersion: Math.round(dispersion * 10) / 10,
    lockedIn: n >= 8 && dispersion <= goal,
  };
}

// Tono de la dispersión para color-coding (narrow the gap)
export function dispersionTone(disp: number | null, goal = 4): "good" | "warn" | "bad" | "neutral" {
  if (disp == null) return "neutral";
  if (disp <= goal) return "good";
  if (disp <= goal * 2.5) return "warn";
  return "bad";
}
