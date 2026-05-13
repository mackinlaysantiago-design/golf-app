/**
 * Helpers para Club Dispersion (CSV parsing + tipos).
 *
 * Formato esperado del CSV (header obligatorio):
 *   club,n,carry_p25,carry_p50,carry_p90,confidence_pct,lat_p50,pct_right,lat_spread_p90,sessions_count,last_updated
 *
 * Ejemplo de fila:
 *   Driver,73,234.2,252.8,270.0,37.0,7.2,61.6,54.5,5,2026-05
 *
 * Usa percentiles (no σ) — más robusto a outliers. Replica el approach de /range/stats viejo.
 */

export type DispersionRow = {
  club: string;
  n: number;
  carryP25: number;
  carryP50: number;
  carryP90: number;
  confidencePct: number;
  latP50: number; // firmado: + derecha, − izquierda
  pctRight: number;
  latSpreadP90: number;
  sessionsCount: number;
  lastUpdated: string; // "YYYY-MM"
};

export type ParseResult =
  | { ok: true; rows: DispersionRow[] }
  | { ok: false; error: string };

/** Mapping del header CSV (snake_case) a las keys del tipo (camelCase). */
const HEADER_MAP: Record<string, keyof DispersionRow> = {
  club: "club",
  n: "n",
  carry_p25: "carryP25",
  carry_p50: "carryP50",
  carry_p90: "carryP90",
  confidence_pct: "confidencePct",
  lat_p50: "latP50",
  pct_right: "pctRight",
  lat_spread_p90: "latSpreadP90",
  sessions_count: "sessionsCount",
  last_updated: "lastUpdated",
};

export function parseDispersionCsv(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "CSV vacío" };

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { ok: false, error: "Necesita header + al menos 1 fila" };
  }

  // Header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colIndex: Partial<Record<keyof DispersionRow, number>> = {};
  for (let i = 0; i < header.length; i++) {
    const key = HEADER_MAP[header[i]];
    if (key) colIndex[key] = i;
  }
  const required: (keyof DispersionRow)[] = [
    "club",
    "carryP25",
    "carryP50",
    "carryP90",
    "latP50",
  ];
  for (const r of required) {
    if (colIndex[r] === undefined) {
      return { ok: false, error: `Falta columna requerida: ${r}` };
    }
  }

  // Data rows
  const rows: DispersionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const club = cells[colIndex.club!];
    if (!club) continue; // skip empty

    const row: DispersionRow = {
      club,
      n: Math.max(1, Math.round(numAt(cells, colIndex.n, 0))),
      carryP25: numAt(cells, colIndex.carryP25, 0),
      carryP50: numAt(cells, colIndex.carryP50, 0),
      carryP90: numAt(cells, colIndex.carryP90, 0),
      confidencePct: numAt(cells, colIndex.confidencePct, 0),
      latP50: numAt(cells, colIndex.latP50, 0),
      pctRight: numAt(cells, colIndex.pctRight, 50),
      latSpreadP90: numAt(cells, colIndex.latSpreadP90, 0),
      sessionsCount: Math.max(1, Math.round(numAt(cells, colIndex.sessionsCount, 1))),
      lastUpdated: colIndex.lastUpdated !== undefined ? cells[colIndex.lastUpdated] : "",
    };
    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, error: "No se encontró ninguna fila válida" };
  }

  return { ok: true, rows };
}

function numAt(cells: string[], idx: number | undefined, def: number): number {
  if (idx === undefined) return def;
  const n = parseFloat(cells[idx]);
  return isNaN(n) ? def : n;
}

/**
 * Texto del "aim recomendado" — replica la lógica del /range/stats viejo.
 * Si bias < 3 yds → centrado. Si no → apuntá al lado opuesto.
 */
export function aimText(latP50: number, pctRight: number): {
  dir: "L" | "R" | "C";
  magnitude: number;
  label: string;
  aim: string;
  dominance: number;
} {
  const abs = Math.abs(latP50);
  if (abs < 3) {
    return { dir: "C", magnitude: 0, label: "centrado", aim: "Apuntá al target", dominance: 50 };
  }
  const dir = latP50 > 0 ? "R" : "L";
  const sideName = dir === "R" ? "derecha" : "izquierda";
  const oppSide = dir === "R" ? "izquierda" : "derecha";
  const dominance = dir === "R" ? pctRight : 100 - pctRight;
  return {
    dir,
    magnitude: abs,
    label: `${abs.toFixed(0)}y a la ${sideName}`,
    aim: `Apuntá ${abs.toFixed(0)}y a la ${oppSide}${dominance >= 70 ? "" : ` (${dominance.toFixed(0)}% de las veces)`}`,
    dominance,
  };
}
