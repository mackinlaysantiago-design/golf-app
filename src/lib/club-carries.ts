import type { ClubCarry } from "./shot-gps";
import { WEDGES, SWING_POSITIONS } from "./wedge-matrix";

// Tabla de "qué palo hace esta distancia", armada con datos MEDIDOS:
//  - juego largo → ClubDispersion (carry P50 de FlightScope)
//  - juego corto → Wedge Matrix (avg por celda palo × posición de swing)
//
// Antes esto era una constante hardcodeada que había quedado vieja: tenía el LW en
// 123 yd (número que no existe, venía de una etiqueta mal puesta en el radar) y no
// tenía el 56.
//
// El 60 (LW) queda AFUERA a propósito: Santi no lo usa, alrededor del green juega
// con el 56 porque el lob es muy riesgoso. Si alguna vez lo retoma, sacarlo de acá.
const EXCLUDED_CLUBS = new Set(["LW", "Lob Wedge", "60"]);

// ClubDispersion guarda nombres tipo "Driver" / "3 Wood" / "4 Iron" / "PW".
// La bolsa real de Santi se nombra W / 52 / 56 / 60 (ver lib/wedge-matrix.ts).
const LONG_CLUB_LABEL: Record<string, string> = {
  Driver: "Driver",
  "3 Wood": "3W",
  "4 Iron": "4i",
  "5 Iron": "5i",
  "6 Iron": "6i",
  "7 Iron": "7i",
  "8 Iron": "8i",
  "9 Iron": "9i",
  PW: "W",
};

const SWING_LABEL: Record<string, string> = {
  FULL: "full",
  THREE_QUARTER: "¾",
  HALF: "½",
  PITCH: "¼",
};

export type DispersionRow = { club: string; carryP50: number | null };
export type WedgeCell = { wedgeType: string; swingType: string; avgYards: number };

/**
 * Arma la tabla de carries a partir de lo medido. Sin datos devuelve [] — el caller
 * decide qué hacer (mejor no sugerir nada que sugerir un número inventado).
 *
 * Los wedges entran con la posición de swing en el nombre ("56 ¾"), que es lo que
 * hace útil a la Wedge Matrix: para 63 yd la respuesta no es "un wedge", es "56 ½".
 */
export function buildClubCarries(
  dispersions: DispersionRow[],
  wedgeCells: WedgeCell[],
): ClubCarry[] {
  const out: ClubCarry[] = [];

  for (const d of dispersions) {
    if (d.carryP50 == null || EXCLUDED_CLUBS.has(d.club)) continue;
    const label = LONG_CLUB_LABEL[d.club];
    if (!label) continue; // palo que no está en la bolsa (hybrids, 3i, etc.)
    out.push({ club: label, carryYds: d.carryP50 });
  }

  const wedgeLabel = new Map<string, string>(WEDGES.map((w) => [w.key, w.label]));
  const validSwing = new Set<string>(SWING_POSITIONS.map((s) => s.key));
  for (const c of wedgeCells) {
    if (EXCLUDED_CLUBS.has(c.wedgeType)) continue;
    const label = wedgeLabel.get(c.wedgeType);
    const swing = SWING_LABEL[c.swingType];
    if (!label || !swing || !validSwing.has(c.swingType)) continue;
    // El W a swing completo también viene del juego largo (PW en ClubDispersion).
    // Gana el de la matriz: es el dato específico de gapping, medido para esto.
    if (label === "W" && c.swingType === "FULL") {
      const dup = out.findIndex((x) => x.club === "W");
      if (dup >= 0) out.splice(dup, 1);
    }
    out.push({ club: `${label} ${swing}`, carryYds: c.avgYards });
  }

  return out.sort((a, b) => b.carryYds - a.carryYds);
}
