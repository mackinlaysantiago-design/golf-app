/**
 * Mapping de drills a las 5 áreas TSM oficiales + Drill/Test kind.
 *
 * Ref: docs/knowledge-base/12_drill_test_taxonomy.md §12.5 (Five Areas of Short Game)
 *
 * - DRILL: build skill, repetition, technique focus.
 * - TEST: measure skill, one ball, pressure, high accountability.
 * - 5 áreas short game + 1 long game (Go-To Club queda aparte).
 */

import type { DrillType } from "./pp-drills";

export type TsmArea =
  | "SHORT_PUTTING"
  | "LONG_PUTTING"
  | "FRINGE_CHIPPING"
  | "PITCHING"
  | "BUNKER_PLAY"
  | "LONG_GAME"; // 6ta área para Go-To Club / driving

export type DrillKind = "DRILL" | "TEST";

export const AREA_LABEL: Record<TsmArea, string> = {
  SHORT_PUTTING: "Short Putting",
  LONG_PUTTING: "Long Putting",
  FRINGE_CHIPPING: "Fringe Chipping",
  PITCHING: "Pitching",
  BUNKER_PLAY: "Bunker Play",
  LONG_GAME: "Long Game",
};

export const AREA_DESCRIPTION: Record<TsmArea, string> = {
  SHORT_PUTTING: "Putts cortos (face control) · target 1-Putt Circle",
  LONG_PUTTING: "Lag putts (speed control) · target 1-Putt Circle desde lejos",
  FRINGE_CHIPPING: "Chips desde el fringe · landing zone + rollout",
  PITCHING: "Wedge gapping (50-100 yds) · proximity",
  BUNKER_PLAY: "Salidas de bunker · consistent sand entry",
  LONG_GAME: "Driver, maderas, hierros largos · Go-To Club",
};

export const AREA_ORDER: TsmArea[] = [
  "SHORT_PUTTING",
  "LONG_PUTTING",
  "FRINGE_CHIPPING",
  "PITCHING",
  "BUNKER_PLAY",
  "LONG_GAME",
];

// Mapping de cada DrillType del catálogo existente → (area TSM, kind)
export const DRILL_TO_AREA: Record<DrillType, { area: TsmArea; kind: DrillKind }> = {
  ONE_PUTT_CIRCLE: { area: "SHORT_PUTTING", kind: "TEST" },
  TWO_PUTT_CIRCLE: { area: "LONG_PUTTING", kind: "TEST" },
  CHIPPING: { area: "FRINGE_CHIPPING", kind: "TEST" },
  WEDGES_50: { area: "PITCHING", kind: "TEST" },
  WEDGES_70: { area: "PITCHING", kind: "TEST" },
  WEDGES_100: { area: "PITCHING", kind: "TEST" },
  GO_TO_CLUB: { area: "LONG_GAME", kind: "TEST" },
  CHIPPING_ONE_HAND: { area: "FRINGE_CHIPPING", kind: "DRILL" },
  CHIPPING_CLUB_FRONT: { area: "FRINGE_CHIPPING", kind: "DRILL" },
  PUTTING_START_LINE: { area: "SHORT_PUTTING", kind: "DRILL" },
  PUTTING_SWORD: { area: "SHORT_PUTTING", kind: "DRILL" },
  PUTTING_LAG_STAKES: { area: "LONG_PUTTING", kind: "DRILL" },
  GREEN_READING: { area: "LONG_PUTTING", kind: "DRILL" },
  SHORT_PUTTING_STREAK: { area: "SHORT_PUTTING", kind: "TEST" },
};

/** Drills agrupados por área, separados por kind. */
export function drillsByArea(): Record<TsmArea, { drills: DrillType[]; tests: DrillType[] }> {
  const out: Record<TsmArea, { drills: DrillType[]; tests: DrillType[] }> = {
    SHORT_PUTTING: { drills: [], tests: [] },
    LONG_PUTTING: { drills: [], tests: [] },
    FRINGE_CHIPPING: { drills: [], tests: [] },
    PITCHING: { drills: [], tests: [] },
    BUNKER_PLAY: { drills: [], tests: [] },
    LONG_GAME: { drills: [], tests: [] },
  };
  for (const [type, { area, kind }] of Object.entries(DRILL_TO_AREA) as [
    DrillType,
    { area: TsmArea; kind: DrillKind },
  ][]) {
    if (kind === "DRILL") out[area].drills.push(type);
    else out[area].tests.push(type);
  }
  return out;
}

/** Para un PP code (A/B/1/2), retorna las áreas más relevantes para ese problema. */
export function areasForPpCode(ppCode: "A" | "B" | "1" | "2"): TsmArea[] {
  switch (ppCode) {
    case "A":
      return ["LONG_GAME"]; // no entró a SZ → trabajar Go-To Club
    case "B":
      return ["FRINGE_CHIPPING", "PITCHING", "BUNKER_PLAY"]; // no down in 3 desde SZ
    case "1":
      return ["SHORT_PUTTING"]; // putts errados <6ft
    case "2":
      return ["LONG_PUTTING"]; // 3+ putts
  }
}
