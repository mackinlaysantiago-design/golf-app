// Plan de práctica TSM: áreas donde hubo errores en la ronda → drill del área → test del área.
// Regla del método (KB 12_drill_test_taxonomy §12.1/12.5): DRILL primero (build skill),
// TEST después (measure skill). Cada área tiene UN drill y UN test principales.
//
// Señales de error por área (con lo que la ronda efectivamente trackea):
// - SHORT_PUTTING: putts errados dentro del 1-putt circle.
// - LONG_PUTTING: hoyos con 3+ putts (mal speed control).
// - FRINGE_CHIPPING / PITCHING: no bajó en N desde la SZ; se separa por la distancia de
//   entrada (distanceInRegYds ≈ pasos): ≤ CHIP_MAX_PASOS es chip, más lejos es pitch.
// - LONG_GAME: no entró a la SZ en regulación.
// - BUNKER_PLAY: sin señal (la ronda no trackea bunkers) ni drill implementado — no aparece.

import { AREA_LABEL, type TsmArea } from "./pp-areas";
import type { DrillType } from "./pp-drills";
import type { HoleData, RoundConfig, RoundKPIs } from "./scoring-method";

export const CHIP_MAX_PASOS = 25; // hasta ~25 pasos del green lo tratamos como chip

export type TsmPlanArea = {
  area: TsmArea;
  label: string;
  errors: number;
  evidence: string; // de dónde sale el número (para mostrar en la card)
  drill: DrillType | null; // build skill — primero
  test: DrillType | null; // measure skill — después
  wedgeMatrixDrill?: boolean; // el drill de Pitching es la Wedge Matrix (módulo aparte)
};

export function computeTsmPlan(
  holes: HoleData[],
  config: RoundConfig,
  kpis: RoundKPIs,
): TsmPlanArea[] {
  // Separar los "no bajó en N desde SZ" en chip vs pitch por distancia de entrada
  let chipFails = 0;
  let pitchFails = 0;
  for (const h of holes) {
    if (h.strokesInsideSz == null) continue;
    if (h.strokesInsideSz <= config.downInSzStrokes) continue;
    if (h.distanceInRegYds != null && h.distanceInRegYds <= CHIP_MAX_PASOS) chipFails++;
    else pitchFails++;
  }
  const notInSz =
    kpis.enterSzDataHoles > 0 ? kpis.enterSzDataHoles - kpis.enterSzCount : 0;

  const plural = (n: number) => (n === 1 ? "hoyo" : "hoyos");
  const items: TsmPlanArea[] = [
    {
      area: "SHORT_PUTTING",
      label: AREA_LABEL.SHORT_PUTTING,
      errors: kpis.missedIn1PuttCircleHoles,
      evidence: `${kpis.missedIn1PuttCircleHoles} ${plural(kpis.missedIn1PuttCircleHoles)} con putt errado dentro del 1-putt circle`,
      drill: "PUTTING_SWORD",
      test: "SHORT_PUTTING_STREAK",
    },
    {
      area: "LONG_PUTTING",
      label: AREA_LABEL.LONG_PUTTING,
      errors: kpis.threePuttsHoles,
      evidence: `${kpis.threePuttsHoles} ${plural(kpis.threePuttsHoles)} con 3+ putts`,
      drill: "PUTTING_LAG_STAKES",
      test: "TWO_PUTT_CIRCLE",
    },
    {
      area: "FRINGE_CHIPPING",
      label: AREA_LABEL.FRINGE_CHIPPING,
      errors: chipFails,
      evidence: `${chipFails} ${plural(chipFails)} sin bajar en ${config.downInSzStrokes} desde ≤${CHIP_MAX_PASOS} pasos`,
      drill: "CHIPPING_CLUB_FRONT",
      test: "CHIPPING",
    },
    {
      area: "PITCHING",
      label: AREA_LABEL.PITCHING,
      errors: pitchFails,
      evidence: `${pitchFails} ${plural(pitchFails)} sin bajar en ${config.downInSzStrokes} desde >${CHIP_MAX_PASOS} pasos`,
      drill: null,
      wedgeMatrixDrill: true,
      test: "WEDGES_50",
    },
    {
      area: "LONG_GAME",
      label: AREA_LABEL.LONG_GAME,
      errors: notInSz,
      evidence: `${notInSz} ${plural(notInSz)} sin entrar a la SZ (${config.enterSzYds} yds) en regulación`,
      drill: null,
      test: "GO_TO_CLUB",
    },
  ];

  // Orden del método: atacar primero el área con más errores
  return items.sort((a, b) => b.errors - a.errors);
}

/** DrillTypes (drill primero, test después) de las áreas con errores — para ?drills= */
export function tsmPlanDrillTypes(plan: TsmPlanArea[]): DrillType[] {
  const out: DrillType[] = [];
  for (const p of plan) {
    if (p.errors <= 0) continue;
    if (p.drill) out.push(p.drill);
    if (p.test) out.push(p.test);
  }
  return out;
}
