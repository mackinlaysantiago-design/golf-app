/**
 * Helper de Auto-PP: analiza PracticeTasks pendientes + rondas recientes
 * para sugerir áreas y drills a trabajar en la próxima sesión.
 *
 * Filosofía: "Drill first, then test" (12_drill_test_taxonomy.md §12.1).
 * Por cada área detectada como débil, sugerimos:
 *   - Test principal (el "measure")
 *   - Drill complementario opcional (el "build")
 */

import type { DrillType } from "./pp-drills";
import { DRILL_BY_TYPE } from "./pp-drills";
import { areasForPpCode, DRILL_TO_AREA, type TsmArea } from "./pp-areas";

export type PracticeTaskInput = {
  id: string;
  code: string; // "A" | "B" | "1" | "2"
  label: string;
  timesToAchieve: number;
  timesCompleted: number;
  roundDate?: Date;
};

export type AreaSuggestion = {
  area: TsmArea;
  /** Drills sugeridos para esta área (test primero, drill opcional). */
  suggestedDrills: Array<{
    type: DrillType;
    kind: "DRILL" | "TEST";
    reason: string;
    /** Cuántas veces lograr el target (de la PracticeTask, o default). */
    timesToAchieve: number;
    /** Tasks que originaron esta sugerencia. */
    sourceTaskIds: string[];
  }>;
  /** Razones agregadas (para mostrar al usuario en el panel). */
  reasons: string[];
  /** Prioridad (más alta = más urgente). */
  priority: number;
};

/**
 * Genera sugerencias de Auto-PP a partir de las tasks pendientes.
 * Agrupa tasks por área TSM, prioriza por cantidad/recencia.
 */
export function suggestAutoPp(tasks: PracticeTaskInput[]): AreaSuggestion[] {
  // Agrupar tasks por área TSM via ppCode
  const byArea = new Map<TsmArea, PracticeTaskInput[]>();
  for (const t of tasks) {
    const code = t.code as "A" | "B" | "1" | "2";
    if (!["A", "B", "1", "2"].includes(code)) continue;
    const primaryArea = areasForPpCode(code)[0]; // primera área es la más directa
    if (!primaryArea) continue;
    if (!byArea.has(primaryArea)) byArea.set(primaryArea, []);
    byArea.get(primaryArea)!.push(t);
  }

  // Por cada área, elegir drills + tests del catálogo
  const out: AreaSuggestion[] = [];
  byArea.forEach((areaTasks: PracticeTaskInput[], area: TsmArea) => {
    const drillsInArea = (Object.entries(DRILL_TO_AREA) as [DrillType, { area: TsmArea; kind: "DRILL" | "TEST" }][])
      .filter(([, m]) => m.area === area);

    // El test principal del área (el TEST con más prioridad: el "canónico" del PDF de TSM)
    const test = pickPrimaryTest(area, drillsInArea);
    const drill = pickComplementaryDrill(area, drillsInArea);

    const reasons: string[] = areaTasks.map((t: PracticeTaskInput) => `${t.label} · pendiente`);
    const timesToAchieve = Math.max(
      1,
      ...areaTasks.map((t: PracticeTaskInput) => t.timesToAchieve - t.timesCompleted),
    );

    const suggestedDrills: AreaSuggestion["suggestedDrills"] = [];
    if (test) {
      const def = DRILL_BY_TYPE[test];
      suggestedDrills.push({
        type: test,
        kind: "TEST",
        reason: `Test · ${def.shortLabel}`,
        timesToAchieve,
        sourceTaskIds: areaTasks.map((t: PracticeTaskInput) => t.id),
      });
    }
    if (drill && drill !== test) {
      const def = DRILL_BY_TYPE[drill];
      suggestedDrills.push({
        type: drill,
        kind: "DRILL",
        reason: `Drill · ${def.shortLabel}`,
        timesToAchieve: 1,
        sourceTaskIds: areaTasks.map((t: PracticeTaskInput) => t.id),
      });
    }

    out.push({
      area,
      suggestedDrills,
      reasons,
      priority: areaTasks.length, // simple: más tasks = más prioritario
    });
  });

  // Sort por prioridad desc
  out.sort((a, b) => b.priority - a.priority);
  return out;
}

/** Test principal por área (el de mayor "presencia" en el método). */
function pickPrimaryTest(
  area: TsmArea,
  drillsInArea: [DrillType, { area: TsmArea; kind: "DRILL" | "TEST" }][],
): DrillType | null {
  const tests = drillsInArea.filter(([, m]) => m.kind === "TEST").map(([t]) => t);
  if (tests.length === 0) return null;
  // Preferencias por área (basadas en el PDF "Short Game Best Drills and Tests")
  const PREF: Partial<Record<TsmArea, DrillType[]>> = {
    SHORT_PUTTING: ["ONE_PUTT_CIRCLE", "SHORT_PUTTING_STREAK"],
    LONG_PUTTING: ["TWO_PUTT_CIRCLE"],
    FRINGE_CHIPPING: ["CHIPPING"],
    PITCHING: ["WEDGES_50", "WEDGES_70", "WEDGES_100"],
    LONG_GAME: ["GO_TO_CLUB"],
  };
  const pref = PREF[area];
  if (pref) {
    for (const p of pref) {
      if (tests.includes(p)) return p;
    }
  }
  return tests[0];
}

/** Drill complementario por área (opcional, para "build skill" antes del test). */
function pickComplementaryDrill(
  area: TsmArea,
  drillsInArea: [DrillType, { area: TsmArea; kind: "DRILL" | "TEST" }][],
): DrillType | null {
  const drills = drillsInArea.filter(([, m]) => m.kind === "DRILL").map(([t]) => t);
  if (drills.length === 0) return null;
  const PREF: Partial<Record<TsmArea, DrillType[]>> = {
    SHORT_PUTTING: ["PUTTING_SWORD", "PUTTING_START_LINE"],
    LONG_PUTTING: ["PUTTING_LAG_STAKES", "GREEN_READING"],
    FRINGE_CHIPPING: ["CHIPPING_ONE_HAND", "CHIPPING_CLUB_FRONT"],
  };
  const pref = PREF[area];
  if (pref) {
    for (const p of pref) {
      if (drills.includes(p)) return p;
    }
  }
  return drills[0];
}
