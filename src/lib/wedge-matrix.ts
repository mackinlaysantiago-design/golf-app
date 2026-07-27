// Lógica del módulo Wedge Matrix (wedge gapping) — The Scoring Method, doc KB 13.
// La matriz son distancias conocidas = wedge × posición de swing.
// El carry (no el total) es lo que se mapea. KPI rey de una celda = dispersión (max-min).

// Labels = la bolsa real de Santi (W / 52 / 56 / 60); las keys quedan genéricas en DB.
export const WEDGES = [
  { key: "PW", label: "W" },
  { key: "GW", label: "52" },
  { key: "SW", label: "56" },
  { key: "LW", label: "60" },
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

// Clasifica el nombre de un "palo" del CSV.
// Si tiene wedge + posición → celda de la matriz; si no → palo común (sesión de range).
// Reconoce sinónimos. NO usa números de loft sueltos para evitar ambigüedad con %.
export type ClubClass =
  | { kind: "cell"; wedge: WedgeKey; swing: SwingKey }
  | { kind: "club"; club: string };

export function parseClubName(raw: string): ClubClass {
  const s = raw.toLowerCase().trim();

  // posición de swing
  let swing: SwingKey | null = null;
  if (/(^|\W)(full|100%?)(\W|$)/.test(s)) swing = "FULL";
  else if (/(3\s*\/\s*4|¾|three[\s-]*quarter|75%?)/.test(s)) swing = "THREE_QUARTER";
  else if (/(1\s*\/\s*2|half|50%)/.test(s)) swing = "HALF";
  else if (/(1\s*\/\s*4|25%)/.test(s)) swing = "PITCH"; // Santi nombra el pitch como "1/4"
  else if (/(^|\W)pitch(\W|$)/.test(s) && !/pitching/.test(s)) swing = "PITCH";

  // tipo de wedge — incluye la bolsa real de Santi: W / 52 / 56 / 60
  let wedge: WedgeKey | null = null;
  if (/(^|\W)(lob|lw|60)(\W|$)/.test(s)) wedge = "LW";
  else if (/(^|\W)(sand|sw|56)(\W|$)/.test(s)) wedge = "SW";
  else if (/(^|\W)(gap|gw|52)(\W|$)/.test(s)) wedge = "GW";
  else if (/pitching|(^|\W)(pw|w|wedge)(\W|$)/.test(s)) wedge = "PW";

  if (wedge && swing) return { kind: "cell", wedge, swing };
  return { kind: "club", club: normalizeClub(raw) };
}

// Mapea nombres comunes de FlightScope al enum de club de la app.
export function normalizeClub(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (/driver/.test(s)) return "DRIVER";
  if (/3\s*wood|wood\s*3/.test(s)) return "WOOD_3";
  if (/5\s*wood|wood\s*5/.test(s)) return "WOOD_5";
  if (/hybrid|rescue|híbrido/.test(s)) return "HYBRID";
  const iron = s.match(/(\d)\s*iron|iron\s*(\d)/);
  if (iron) return `IRON_${iron[1] ?? iron[2]}`;
  if (/pitching|(^|\W)pw(\W|$)/.test(s)) return "PW";
  if (/gap|(^|\W)(gw|52)(\W|$)/.test(s)) return "GW";
  if (/sand|(^|\W)(sw|56)(\W|$)/.test(s)) return "SW";
  if (/lob|(^|\W)(lw|60)(\W|$)/.test(s)) return "LW";
  // "W" / "wedge" a secas = el pitching de la bolsa de Santi (va al final para no
  // pisar "gap/sand/lob wedge")
  if (/(^|\W)(w|wedge)(\W|$)/.test(s)) return "PW";
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

// Tono de la dispersión para color-coding (narrow the gap)
export function dispersionTone(disp: number | null, goal = 4): "good" | "warn" | "bad" | "neutral" {
  if (disp == null) return "neutral";
  if (disp <= goal) return "good";
  if (disp <= goal * 2.5) return "warn";
  return "bad";
}
