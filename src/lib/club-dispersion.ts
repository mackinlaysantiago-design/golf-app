/**
 * Helpers para Club Dispersion (CSV parsing + tipos).
 *
 * Formato esperado del CSV (header obligatorio):
 *   club,carry_avg_yds,carry_dev_yds,lateral_dev_yds,lateral_bias_yds,lateral_bias_dir,ellipse_length_yds,ellipse_width_yds,sessions_count,last_updated
 *
 * Ejemplo de fila:
 *   7I,164,7,15,0.9,L,14,30,2,2026-05
 */

export type DispersionRow = {
  club: string;
  carryAvgYds: number;
  carryDevYds: number;
  lateralDevYds: number;
  lateralBiasYds: number;
  lateralBiasDir: "L" | "R";
  ellipseLengthYds: number;
  ellipseWidthYds: number;
  sessionsCount: number;
  lastUpdated: string; // "YYYY-MM"
};

export type ParseResult =
  | { ok: true; rows: DispersionRow[] }
  | { ok: false; error: string };

/** Mapping del header CSV (snake_case) a las keys del tipo (camelCase). */
const HEADER_MAP: Record<string, keyof DispersionRow> = {
  club: "club",
  carry_avg_yds: "carryAvgYds",
  carry_dev_yds: "carryDevYds",
  lateral_dev_yds: "lateralDevYds",
  lateral_bias_yds: "lateralBiasYds",
  lateral_bias_dir: "lateralBiasDir",
  ellipse_length_yds: "ellipseLengthYds",
  ellipse_width_yds: "ellipseWidthYds",
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
    "carryAvgYds",
    "carryDevYds",
    "lateralDevYds",
    "lateralBiasDir",
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
    const dir = cells[colIndex.lateralBiasDir!].toUpperCase();
    if (dir !== "L" && dir !== "R") {
      return { ok: false, error: `Fila ${i}: lateral_bias_dir debe ser L o R, vino "${cells[colIndex.lateralBiasDir!]}"` };
    }
    const row: DispersionRow = {
      club,
      carryAvgYds: numOr(cells[colIndex.carryAvgYds!], 0),
      carryDevYds: numOr(cells[colIndex.carryDevYds!], 0),
      lateralDevYds: numOr(cells[colIndex.lateralDevYds!], 0),
      lateralBiasYds: numOr(colIndex.lateralBiasYds !== undefined ? cells[colIndex.lateralBiasYds] : "0", 0),
      lateralBiasDir: dir as "L" | "R",
      ellipseLengthYds: numOr(colIndex.ellipseLengthYds !== undefined ? cells[colIndex.ellipseLengthYds] : "0", 0),
      ellipseWidthYds: numOr(colIndex.ellipseWidthYds !== undefined ? cells[colIndex.ellipseWidthYds] : "0", 0),
      sessionsCount: Math.max(1, Math.round(numOr(colIndex.sessionsCount !== undefined ? cells[colIndex.sessionsCount] : "1", 1))),
      lastUpdated: colIndex.lastUpdated !== undefined ? cells[colIndex.lastUpdated] : "",
    };
    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, error: "No se encontró ninguna fila válida" };
  }

  return { ok: true, rows };
}

function numOr(v: string, def: number): number {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

/** Orden canónico de palos (desde driver al más corto). */
export const CLUB_ORDER_DISPERSION = [
  "Driver",
  "3W",
  "5W",
  "7W",
  "2H",
  "3H",
  "4H",
  "5H",
  "2I",
  "3I",
  "4I",
  "5I",
  "6I",
  "7I",
  "8I",
  "9I",
  "PW",
  "GW",
  "SW",
  "LW",
];

export function sortClubsByDistance(rows: DispersionRow[]): DispersionRow[] {
  return [...rows].sort((a, b) => {
    // Primero por avg desc (driver primero), después por nombre
    if (a.carryAvgYds !== b.carryAvgYds) return b.carryAvgYds - a.carryAvgYds;
    return a.club.localeCompare(b.club);
  });
}
