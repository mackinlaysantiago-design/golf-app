"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_CHALLENGES } from "@/lib/sm-challenges";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  DRILLS,
  GO_TO_CLUB_LADDER,
  CLUB_LABEL,
  DRILL_AREA_LABEL,
  type DrillType,
  type DrillDef,
  type DrillArea,
  distToUi,
  uiToDist,
  uiUnit,
} from "@/lib/pp-drills";
import { DRILL_TO_AREA, AREA_ORDER } from "@/lib/pp-areas";
import { useFormDraft } from "@/hooks/useFormDraft";

// Key del IndexedDB draft (única por tipo de form, app-wide)
// v2: invalida drafts guardados en ft (pre-pasos, 27/07) — ej. el "35 pasos" fantasma
const DRAFT_KEY = "pp-session-draft-v2";

/** Sortea drills por área TSM, después DRILL primero, TEST después. */
function sortDrillsTsm(drills: DrillDef[]): DrillDef[] {
  return [...drills].sort((a, b) => {
    const am = DRILL_TO_AREA[a.type];
    const bm = DRILL_TO_AREA[b.type];
    const areaCmp = AREA_ORDER.indexOf(am.area) - AREA_ORDER.indexOf(bm.area);
    if (areaCmp !== 0) return areaCmp;
    if (am.kind !== bm.kind) return am.kind === "DRILL" ? -1 : 1;
    return 0;
  });
}

// Estado de input por drill: vamos a usar shapes distintos por formato.
// Para simplificar, manejamos un único objeto por drill.
type StreakRow = { distance: string; streak: string };
type RatioLowerRow = { distance: string; strokes: string; balls: string };
type RatioHigherRow = { inTarget: string; balls: string };
type LegacyRow = { value: string };
type GoToRow = { club: string; fw: string; left: string; right: string };

type DrillEntry = {
  enabled: boolean;
  // Streak
  streakRows?: StreakRow[];
  // RatioLower
  ratioLowerRows?: RatioLowerRow[];
  // RatioHigher
  ratioHigherRows?: RatioHigherRow[];
  // Legacy (ratings 1-5): cada intento es un número
  legacyRows?: LegacyRow[];
  // Go-To Club: por tanda de 9 → fw / izquierda / derecha
  goToRows?: GoToRow[];
  // Para legacy
  distance: string;
  club: string;
  timesToAchieve: string;
  notes: string;
};

type LevelInfo = {
  drillType: DrillType;
  currentDistance?: number;
  currentClub?: string;
  bestAtCurrent: number | null;
  bestEver: number | null;
  bestStreakByDist?: Record<number, number>;
  bestRatioByDist?: Record<number, { strokes: number; balls: number; ratio: number }>;
  bestRatio?: { inTarget: number; balls: number; ratio: number } | null;
};

type PlanInfo = {
  drillTargets: Record<string, { timesToAchieve: number; ppCode: string }>;
  lastRoundDate?: string;
  lastRoundCourse?: string;
};

function emptyEntry(d: DrillDef): DrillEntry {
  // Todo el estado de la página vive en unidades de UI (pasos); se convierte a la
  // unidad nativa del drill (ft/yds, benchmarks TSM) recién al guardar.
  const dd = String(distToUi(d, d.defaultDistance));
  const base = {
    enabled: false,
    distance: dd,
    club: d.type === "GO_TO_CLUB" ? GO_TO_CLUB_LADDER[0] : "",
    timesToAchieve: "1",
    notes: "",
  };
  if (d.format === "STREAK_BY_DIST") {
    return { ...base, streakRows: [{ distance: dd, streak: "" }] };
  }
  if (d.format === "RATIO_LOWER_BY_DIST") {
    return { ...base, ratioLowerRows: [{ distance: dd, strokes: "", balls: "" }] };
  }
  if (d.format === "RATIO_HIGHER") {
    return { ...base, ratioHigherRows: [{ inTarget: "", balls: "" }] };
  }
  if (d.format === "GO_TO_DIR") {
    return { ...base, goToRows: [{ club: GO_TO_CLUB_LADDER[0], fw: "", left: "", right: "" }] };
  }
  return { ...base, legacyRows: [{ value: "" }] };
}

export default function NuevaPPPage() {
  const router = useRouter();
  // Leer query params client-side sin useSearchParams (que rompe prerender)
  const [challengeCtx, setChallengeCtx] = useState<{
    challengeId: string | null;
    day: number | null;
  }>({ challengeId: null, day: null });
  // Drills preseleccionados vía ?drills= (vienen del plan TSM del resumen/hub o de una task de homework)
  const [preselectedDrills, setPreselectedDrills] = useState<Set<DrillType> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    setChallengeCtx({
      challengeId: url.searchParams.get("challenge"),
      day: url.searchParams.get("day") ? parseInt(url.searchParams.get("day")!) : null,
    });
    const drillsParam = url.searchParams.get("drills");
    if (drillsParam) {
      setPreselectedDrills(new Set(drillsParam.split(",") as DrillType[]));
    }
  }, []);
  const challenge = challengeCtx.challengeId
    ? ALL_CHALLENGES.find((c) => c.id === challengeCtx.challengeId)
    : null;
  const challengeDayInfo = challenge && challengeCtx.day != null
    ? challenge.days.find((d) => d.day === challengeCtx.day)
    : null;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  // Cuando se cargue el contexto del challenge, pre-rellenar las notas
  useEffect(() => {
    if (challengeDayInfo && challenge && !notes) {
      setNotes(`Challenge: ${challenge.title} · ${challengeDayInfo.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeDayInfo?.day, challenge?.id]);
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<Record<string, LevelInfo>>({});
  const [plan, setPlan] = useState<PlanInfo>({ drillTargets: {} });

  const initial: Record<DrillType, DrillEntry> = Object.fromEntries(
    DRILLS.map((d) => [d.type, emptyEntry(d)]),
  ) as Record<DrillType, DrillEntry>;
  const [drills, setDrills] = useState(initial);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftMountedRef = useRef(false);

  // ===== Auto-save vía IndexedDB =====
  // Patrón de agroflow-platform: idb async + debounce 2s + cleanup automático.
  const draft = useFormDraft({ key: DRAFT_KEY, formType: "pp-session", debounceMs: 1500 });

  // Restaurar draft al montar (una sola vez — el guard con draftMountedRef es
  // OBLIGATORIO: si este efecto re-corre, pisa lo que el usuario está tipeando)
  useEffect(() => {
    if (draftMountedRef.current) return;
    let cancelled = false;
    (async () => {
      const saved = (await draft.load()) as
        | { date?: string; notes?: string; drills?: Record<DrillType, DrillEntry> }
        | null;
      if (cancelled || !saved) {
        draftMountedRef.current = true;
        return;
      }
      if (saved.drills) {
        setDrills((prev) => ({ ...prev, ...saved.drills }));
        if (saved.date) setDate(saved.date);
        if (saved.notes != null) setNotes(saved.notes);
        setDraftRestored(true);
      }
      draftMountedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  // Persistir cada cambio relevante (debounced, async).
  // Skip hasta que el restore inicial termine para no pisar el draft con state vacío.
  useEffect(() => {
    if (!draftMountedRef.current) return;
    const anyEnabled = Object.values(drills).some((e) => e.enabled);
    if (!anyEnabled && !notes) {
      // Sin nada cargado: limpiar el draft existente (si lo había)
      draft.clear();
      return;
    }
    draft.save({ date, notes, drills });
  }, [date, notes, drills, draft]);

  useEffect(() => {
    Promise.all([
      fetch("/api/pp/levels").then((r) => r.json()),
      fetch("/api/pp/plan").then((r) => r.json()),
    ])
      .then(([levelsData, planData]) => {
        // Los niveles/récords llegan en unidades nativas (ft/yds): convertir a
        // pasos ANTES de setear, así toda la página opera en una sola unidad.
        for (const drill of DRILLS) {
          const lvl = levelsData[drill.type];
          if (!lvl) continue;
          if (lvl.currentDistance != null) lvl.currentDistance = distToUi(drill, lvl.currentDistance);
          if (lvl.bestStreakByDist) {
            const merged: Record<number, number> = {};
            for (const [k, v] of Object.entries(lvl.bestStreakByDist)) {
              const key = distToUi(drill, Number(k));
              merged[key] = Math.max(merged[key] ?? 0, v as number);
            }
            lvl.bestStreakByDist = merged;
          }
          if (lvl.bestRatioByDist) {
            const merged: Record<number, { strokes: number; balls: number; ratio: number }> = {};
            for (const [k, v] of Object.entries(lvl.bestRatioByDist)) {
              const key = distToUi(drill, Number(k));
              const vv = v as { strokes: number; balls: number; ratio: number };
              if (!merged[key] || vv.ratio < merged[key].ratio) merged[key] = vv;
            }
            lvl.bestRatioByDist = merged;
          }
        }
        setLevels(levelsData);
        setPlan(planData);
        const targets: Record<string, { timesToAchieve: number; ppCode: string }> =
          planData.drillTargets ?? {};

        setDrills((prev) => {
          const next = { ...prev };
          for (const drill of DRILLS) {
            const lvl = levelsData[drill.type];
            const planTarget = targets[drill.type];
            // Pre-llenar distancia inicial con nivel actual — SOLO si las filas están
            // vírgenes (no pisar lo tipeado ni lo restaurado del draft)
            if (lvl?.currentDistance != null) {
              const dStr = String(lvl.currentDistance);
              next[drill.type] = { ...next[drill.type], distance: dStr };
              if (drill.format === "STREAK_BY_DIST") {
                const rows = next[drill.type].streakRows;
                if (!rows || rows.every((r) => r.streak === "")) {
                  next[drill.type].streakRows = [{ distance: dStr, streak: "" }];
                }
              }
              if (drill.format === "RATIO_LOWER_BY_DIST") {
                const rows = next[drill.type].ratioLowerRows;
                if (!rows || rows.every((r) => r.strokes === "" && r.balls === "")) {
                  next[drill.type].ratioLowerRows = [{ distance: dStr, strokes: "", balls: "" }];
                }
              }
            }
            if (lvl?.currentClub) {
              next[drill.type] = { ...next[drill.type], club: lvl.currentClub };
            }
            // En modo challenge la sesión es SOLO del challenge: no mezclar el plan de ronda
            if (planTarget && !challengeDayInfo) {
              next[drill.type] = {
                ...next[drill.type],
                enabled: true,
                timesToAchieve: String(planTarget.timesToAchieve),
              };
            }
            // Pre-tildar drills del challenge si entró por ese flujo
            if (challengeDayInfo && challengeDayInfo.drills.includes(drill.type)) {
              next[drill.type] = {
                ...next[drill.type],
                enabled: true,
              };
            }
            // Pre-tildar drills preseleccionados por el wizard de /setup
            if (preselectedDrills?.has(drill.type)) {
              next[drill.type] = {
                ...next[drill.type],
                enabled: true,
              };
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, [preselectedDrills, challengeDayInfo]);

  function update<T extends keyof DrillEntry>(type: DrillType, field: T, value: DrillEntry[T]) {
    setDrills((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  // ===== Streak rows =====
  function addStreakRow(type: DrillType) {
    const e = drills[type];
    const last = e.streakRows?.[e.streakRows.length - 1];
    update(type, "streakRows", [...(e.streakRows ?? []), { distance: last?.distance ?? e.distance, streak: "" }]);
  }
  function setStreakRow(type: DrillType, idx: number, field: keyof StreakRow, value: string) {
    const next = [...(drills[type].streakRows ?? [])];
    next[idx] = { ...next[idx], [field]: value };
    update(type, "streakRows", next);
  }
  function removeStreakRow(type: DrillType, idx: number) {
    const next = (drills[type].streakRows ?? []).filter((_, i) => i !== idx);
    update(type, "streakRows", next.length > 0 ? next : [{ distance: drills[type].distance, streak: "" }]);
  }

  // ===== Ratio Lower rows =====
  function addRatioLowerRow(type: DrillType) {
    const e = drills[type];
    const last = e.ratioLowerRows?.[e.ratioLowerRows.length - 1];
    update(type, "ratioLowerRows", [...(e.ratioLowerRows ?? []), { distance: last?.distance ?? e.distance, strokes: "", balls: "" }]);
  }
  function setRatioLowerRow(type: DrillType, idx: number, field: keyof RatioLowerRow, value: string) {
    const next = [...(drills[type].ratioLowerRows ?? [])];
    next[idx] = { ...next[idx], [field]: value };
    update(type, "ratioLowerRows", next);
  }
  function removeRatioLowerRow(type: DrillType, idx: number) {
    const next = (drills[type].ratioLowerRows ?? []).filter((_, i) => i !== idx);
    update(type, "ratioLowerRows", next.length > 0 ? next : [{ distance: drills[type].distance, strokes: "", balls: "" }]);
  }

  // ===== Ratio Higher rows =====
  function addRatioHigherRow(type: DrillType) {
    update(type, "ratioHigherRows", [...(drills[type].ratioHigherRows ?? []), { inTarget: "", balls: "" }]);
  }
  function setRatioHigherRow(type: DrillType, idx: number, field: keyof RatioHigherRow, value: string) {
    const next = [...(drills[type].ratioHigherRows ?? [])];
    next[idx] = { ...next[idx], [field]: value };
    update(type, "ratioHigherRows", next);
  }
  function removeRatioHigherRow(type: DrillType, idx: number) {
    const next = (drills[type].ratioHigherRows ?? []).filter((_, i) => i !== idx);
    update(type, "ratioHigherRows", next.length > 0 ? next : [{ inTarget: "", balls: "" }]);
  }

  // ===== Legacy rows (Go-To Club) =====
  function setGoToRow(type: DrillType, idx: number, field: keyof GoToRow, value: string) {
    const next = [...(drills[type].goToRows ?? [])];
    next[idx] = { ...next[idx], [field]: value };
    update(type, "goToRows", next);
  }
  function addGoToRow(type: DrillType) {
    const prev = drills[type].goToRows ?? [];
    const lastClub = prev.length > 0 ? prev[prev.length - 1].club : GO_TO_CLUB_LADDER[0];
    update(type, "goToRows", [...prev, { club: lastClub, fw: "", left: "", right: "" }]);
  }
  function removeGoToRow(type: DrillType, idx: number) {
    const next = (drills[type].goToRows ?? []).filter((_, i) => i !== idx);
    update(type, "goToRows", next.length > 0 ? next : [{ club: GO_TO_CLUB_LADDER[0], fw: "", left: "", right: "" }]);
  }

  function addLegacyRow(type: DrillType) {
    update(type, "legacyRows", [...(drills[type].legacyRows ?? []), { value: "" }]);
  }
  function setLegacyRow(type: DrillType, idx: number, value: string) {
    const next = [...(drills[type].legacyRows ?? [])];
    next[idx] = { value };
    update(type, "legacyRows", next);
  }
  function removeLegacyRow(type: DrillType, idx: number) {
    const next = (drills[type].legacyRows ?? []).filter((_, i) => i !== idx);
    update(type, "legacyRows", next.length > 0 ? next : [{ value: "" }]);
  }

  async function save() {
    setBusy(true);
    const drillsArr = DRILLS.filter((d) => drills[d.type].enabled).map((d) => {
      const e = drills[d.type];
      let attempts: object | number[] = [];

      if (d.format === "STREAK_BY_DIST") {
        // La UI trabaja en pasos → guardar en la unidad nativa del drill (benchmarks TSM)
        const rows = (e.streakRows ?? [])
          .map((r) => ({ distance: uiToDist(d, parseFloat(r.distance)), streak: parseInt(r.streak) }))
          .filter((r) => !isNaN(r.distance) && !isNaN(r.streak));
        attempts = { type: "STREAK_BY_DIST", attempts: rows };
      } else if (d.format === "RATIO_LOWER_BY_DIST") {
        const rows = (e.ratioLowerRows ?? [])
          .map((r) => ({ distance: uiToDist(d, parseFloat(r.distance)), strokes: parseInt(r.strokes), balls: parseInt(r.balls) }))
          .filter((r) => !isNaN(r.distance) && !isNaN(r.strokes) && !isNaN(r.balls) && r.balls > 0);
        attempts = { type: "RATIO_LOWER_BY_DIST", attempts: rows };
      } else if (d.format === "RATIO_HIGHER") {
        const rows = (e.ratioHigherRows ?? [])
          .map((r) => ({ inTarget: parseInt(r.inTarget), balls: parseInt(r.balls) }))
          .filter((r) => !isNaN(r.inTarget) && !isNaN(r.balls) && r.balls > 0);
        attempts = { type: "RATIO_HIGHER", attempts: rows };
      } else if (d.format === "GO_TO_DIR") {
        const rows = (e.goToRows ?? [])
          .map((r) => ({ club: r.club, fw: parseInt(r.fw), left: parseInt(r.left) || 0, right: parseInt(r.right) || 0 }))
          .filter((r) => !isNaN(r.fw));
        attempts = { type: "GO_TO_DIR", attempts: rows };
      } else {
        // Legacy (ratings 1-5)
        const arr = (e.legacyRows ?? []).map((r) => parseInt(r.value)).filter((n) => !isNaN(n));
        attempts = arr;
      }

      return {
        drillType: d.type,
        distance: e.distance ? uiToDist(d, parseFloat(e.distance)) : null,
        club: d.type === "GO_TO_CLUB" ? e.club : null,
        ppCode: d.ppCode,
        timesToAchieve: e.timesToAchieve ? parseInt(e.timesToAchieve) : null,
        attempts,
        notes: e.notes || null,
      };
    });

    if (drillsArr.length === 0) {
      alert("Marcá al menos un drill");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/pp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(date).toISOString(),
        notes: notes || null,
        drills: drillsArr,
      }),
    });
    if (res.ok) {
      // Limpiar draft al guardar exitoso
      await draft.clear();
      router.push("/range/pp");
      router.refresh();
    } else {
      alert("Error guardando");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva sesión PP</h1>
        <p className="text-sm text-[var(--muted)]">
          Marcá los drills, agregá tantos intentos como hagas. Se guarda automáticamente mientras cargás.
        </p>
      </header>

      {challenge && challengeDayInfo && (
        <Card style={{ borderLeft: "4px solid var(--fairway)" }}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            📅 Challenge · {challenge.title}
          </div>
          <div className="font-bold text-sm mt-0.5">
            Día {challengeDayInfo.day}: {challengeDayInfo.title}
          </div>
        </Card>
      )}

      {draftRestored && (
        <div className="rounded-md border-l-4 bg-[var(--accent-light)] p-2 text-[11px]" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
          <strong>Borrador restaurado.</strong> Si querés empezar de cero, desmarcá todos los drills y recargá.
        </div>
      )}

      {!challengeDayInfo && Object.keys(plan.drillTargets).length > 0 && (
        <Card style={{ borderLeft: "4px solid var(--accent)" }}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Plan de tu última ronda
            {plan.lastRoundCourse && plan.lastRoundDate && (
              <> · {plan.lastRoundCourse} · {new Date(plan.lastRoundDate).toLocaleDateString("es-AR")}</>
            )}
          </div>
          <div className="mt-2 text-xs space-y-1">
            {Object.entries(plan.drillTargets).map(([type, t]) => {
              const def = DRILLS.find((d) => d.type === type);
              if (!def) return null;
              return (
                <div key={type} className="flex justify-between">
                  <span>{def.shortLabel} (PP {t.ppCode})</span>
                  <span className="gf-mono font-bold">{t.timesToAchieve}× lograr target</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">Fecha</label>
          <input
            type="date"
            className="gf-input mt-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">Notas</label>
          <textarea
            className="gf-input mt-1"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Card>

      {(() => {
        // UNA sola vista (26/07, pedido Santi): arriba "Tu plan de hoy" con los drills que
        // vienen del plan TSM / preselección / los que tildaste; TODO el resto del catálogo
        // queda colapsado detrás de "Agregar otro drill".
        const AREA_ORDER: DrillArea[] = ["PUTTING", "CHIPPING", "WEDGES", "LONG_GAME"];
        const inPlanSet = new Set(
          DRILLS.filter(
            (d) =>
              drills[d.type]?.enabled ||
              (!challengeDayInfo && !!plan.drillTargets[d.type]) ||
              (preselectedDrills?.has(d.type) ?? false) ||
              (challengeDayInfo?.drills.includes(d.type) ?? false),
          ).map((d) => d.type),
        );
        const planDrills = sortDrillsTsm(DRILLS.filter((d) => inPlanSet.has(d.type)));
        return (
          <>
            <SectionHeader>{challengeDayInfo ? `Drills del challenge (${planDrills.length})` : `Tu plan de hoy (${planDrills.length})`}</SectionHeader>
            {planDrills.length === 0 ? (
              <div className="text-sm text-[var(--muted)] italic px-1">
                Sin plan de la última ronda — agregá un drill abajo.
              </div>
            ) : (
              planDrills.map((d) => <div key={d.type}>{renderDrill(d)}</div>)
            )}
            <details className="rounded-xl overflow-hidden" style={{ background: "var(--white)" }}>
              <summary className="cursor-pointer p-3 text-sm font-semibold text-[var(--fairway)]">
                ➕ Agregar otro drill
              </summary>
              <div className="space-y-2 px-2 pb-2">
                {AREA_ORDER.map((area) => {
                  const drillsInArea = DRILLS.filter(
                    (d) => d.area === area && !inPlanSet.has(d.type),
                  );
                  if (drillsInArea.length === 0) return null;
                  return (
                    <div key={area}>
                      <SectionHeader>{DRILL_AREA_LABEL[area]}</SectionHeader>
                      {drillsInArea.map((d) => <div key={d.type}>{renderDrill(d)}</div>)}
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        );
      })()}

      <button onClick={save} disabled={busy} className="gf-btn w-full">
        {busy ? "Guardando..." : "💾 Guardar sesión"}
      </button>
    </div>
  );


  // Instrucción concreta de qué escribir en cada campo, por formato de drill
  function inputHelp(d: DrillDef): string {
    if (d.format === "STREAK_BY_DIST") {
      if (d.type === "GREEN_READING")
        return "Cada fila es una tanda: PENDIENTE en grados (1, 2 o 3) y RACHA (putts seguidos embocados antes de errar).";
      return `Cada fila es una tanda: DISTANCIA en ${uiUnit(d)} y RACHA (cuántos seguidos lograste antes de errar). Ej: 2 y 6.`;
    }
    if (d.format === "RATIO_LOWER_BY_DIST")
      return "Cada fila es una tanda: DISTANCIA en pasos, GOLPES totales que necesitaste para embocar todas y cuántas PELOTAS jugaste. Ej: 20, 24 y 9.";
    if (d.format === "RATIO_HIGHER")
      return "Cada fila es una tanda: cuántas dejaste DENTRO del 2-putt circle y cuántas PELOTAS tiraste. Ej: 5 y 9.";
    if (d.type === "GO_TO_CLUB")
      return "Cada fila es una tanda de 9 tiros con UN palo: elegí el PALO y anotá cuántos a la IZQUIERDA, al FAIRWAY y a la DERECHA (izq+fw+der = 9). Tu Go-To = el palo con mejor % de FW acumulado.";
    return "Cada fila es una tanda: anotá tu sensación de 1 a 5 (5 = lo sentiste perfecto).";
  }

  function renderDrill(d: DrillDef) {
    const e = drills[d.type];
    const lvl = levels[d.type];
    const inPlan = !!plan.drillTargets[d.type];

    return (
      <Card
        key={d.type}
        className="space-y-2"
        style={inPlan ? { borderLeft: "4px solid var(--accent)" } : undefined}
      >
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={e.enabled}
            onChange={(ev) => update(d.type, "enabled", ev.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              {d.label}
              <span className="gf-pill text-[10px]">PP {d.ppCode}</span>
              {!d.hasLevelUp && (
                <span className="gf-pill text-[10px]" style={{ background: "#eee", color: "#666" }}>
                  sin level up
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--muted)]">{d.description}</div>
            {renderLevelInfo(d, lvl)}
          </div>
        </label>

        {e.enabled && (
          <div className="space-y-2 pl-6">
            {renderProgressBadge(d, e, lvl)}
            {d.format === "STREAK_BY_DIST" && renderStreakInputs(d, e)}
            {d.format === "RATIO_LOWER_BY_DIST" && renderRatioLowerInputs(d, e)}
            {d.format === "RATIO_HIGHER" && renderRatioHigherInputs(d, e)}
            {d.format === "GO_TO_DIR" && renderGoToInputs(d, e)}
            {d.format === "LEGACY_NUMBER_ARRAY" && renderLegacyInputs(d, e, lvl)}
          </div>
        )}
      </Card>
    );
  }

  /**
   * Badge en vivo que muestra:
   *   - Cuál es el objetivo del drill (cómo se considera "logrado")
   *   - Cuántas veces lo lográs ahora vs cuántas necesitás (timesToAchieve)
   *   - Visual: verde cuando completo, accent cuando en progreso, muted si nada aún
   */
  function renderProgressBadge(d: DrillDef, e: DrillEntry, lvl?: LevelInfo) {
    const target = e.timesToAchieve ? parseInt(e.timesToAchieve) : 1;
    let achieved = 0;
    let goalText = "";

    if (d.format === "STREAK_BY_DIST") {
      const N = d.levelUpStreak ?? d.scoreOf;
      goalText = `Lograr racha ≥${N} a ${e.distance || distToUi(d, d.defaultDistance)} ${uiUnit(d)}`;
      const dist = parseFloat(e.distance);
      const rows = e.streakRows ?? [];
      achieved = rows.filter((r) => {
        const dd = parseFloat(r.distance);
        const ss = parseInt(r.streak);
        return !isNaN(dd) && !isNaN(ss) && (isNaN(dist) || dd >= dist) && ss >= N;
      }).length;
    } else if (d.format === "GO_TO_DIR") {
      // Go-To Club: lograr 9/9 en fairway
      goalText = `Lograr ${d.scoreOf}/${d.scoreOf} en FW`;
      const fws = (e.goToRows ?? []).map((r) => parseInt(r.fw)).filter((n) => !isNaN(n));
      achieved = fws.filter((n) => n >= d.scoreOf).length;
    } else if (d.format === "LEGACY_NUMBER_ARRAY") {
      goalText = `Lograr ${d.scoreOf}/${d.scoreOf}`;
      const arr = (e.legacyRows ?? []).map((r) => parseInt(r.value)).filter((n) => !isNaN(n));
      achieved = arr.filter((n) => n >= d.scoreOf).length;
    } else if (d.format === "RATIO_LOWER_BY_DIST") {
      // Chipping: batir el mejor previo a la distancia (lower = mejor)
      const records = lvl?.bestRatioByDist ?? {};
      const dist = parseFloat(e.distance);
      const best = !isNaN(dist) ? records[dist]?.ratio ?? Infinity : Infinity;
      goalText = isFinite(best)
        ? `Mejorar ratio anterior (${best.toFixed(2)}) a ${e.distance || distToUi(d, d.defaultDistance)} ${uiUnit(d)}`
        : `Primer marca a ${e.distance || distToUi(d, d.defaultDistance)} ${uiUnit(d)}`;
      const rows = e.ratioLowerRows ?? [];
      achieved = rows.filter((r) => {
        const strokes = parseInt(r.strokes);
        const balls = parseInt(r.balls);
        const rDist = parseFloat(r.distance);
        if (isNaN(strokes) || isNaN(balls) || balls === 0) return false;
        const ratio = strokes / balls;
        if (!isNaN(dist) && rDist !== dist) return false;
        return ratio < best;
      }).length;
    } else if (d.format === "RATIO_HIGHER") {
      // Wedges 50/70/100: batir % anterior (higher = mejor)
      const best = lvl?.bestRatio?.ratio ?? -Infinity;
      const bestPct = lvl?.bestRatio ? `${(best * 100).toFixed(0)}%` : "—";
      goalText = isFinite(best)
        ? `Mejorar ${bestPct} en target`
        : `Primera marca en target`;
      const rows = e.ratioHigherRows ?? [];
      achieved = rows.filter((r) => {
        const it = parseInt(r.inTarget);
        const bb = parseInt(r.balls);
        if (isNaN(it) || isNaN(bb) || bb === 0) return false;
        return it / bb > best;
      }).length;
    }

    const done = achieved >= target;
    const inProgress = achieved > 0 && !done;
    const color = done ? "var(--green)" : inProgress ? "var(--accent)" : "var(--muted)";
    const bg = done ? "var(--green-pale)" : inProgress ? "var(--accent-light)" : "#f4f4f4";
    const icon = done ? "✓" : inProgress ? "⏳" : "○";

    return (
      <div
        className="rounded-md p-2 flex items-center justify-between gap-2 text-[11px]"
        style={{ background: bg, color }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-bold uppercase tracking-wider text-[9px] opacity-80">
            Objetivo
          </div>
          <div className="leading-tight">{goalText}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-lg leading-none">{icon}</span>
          <span className="gf-mono font-bold text-base">
            {achieved}/{target}
          </span>
        </div>
      </div>
    );
  }

  function renderLevelInfo(d: DrillDef, lvl?: LevelInfo) {
    if (!lvl) return null;
    if (d.type === "GO_TO_CLUB") {
      if (!lvl.currentClub) return null;
      return (
        <div className="text-[10px] mt-1 gf-mono">
          Tu Go-To actual: <strong>{CLUB_LABEL[lvl.currentClub] ?? lvl.currentClub}</strong>
          <span className="text-[var(--muted)] ml-1">(mejor % de FW acumulado)</span>
        </div>
      );
    }
    if (d.format === "STREAK_BY_DIST") {
      const records = lvl.bestStreakByDist ?? {};
      const dists = Object.keys(records).map(Number).sort((a, b) => a - b);
      return (
        <div className="text-[10px] mt-1 gf-mono">
          Nivel actual: <strong>{lvl.currentDistance} {uiUnit(d)}</strong>
          {dists.length > 0 && (
            <div className="text-[var(--muted)]">
              Récords: {dists.map((dd) => `${dd} ${uiUnit(d)}: ${records[dd]}`).join(" · ")}
            </div>
          )}
        </div>
      );
    }
    if (d.format === "RATIO_LOWER_BY_DIST") {
      const records = lvl.bestRatioByDist ?? {};
      const dists = Object.keys(records).map(Number).sort((a, b) => a - b);
      return (
        <div className="text-[10px] mt-1 gf-mono">
          {dists.length === 0 ? (
            <span className="text-[var(--muted)]">Sin marca anterior</span>
          ) : (
            <div className="text-[var(--muted)]">
              Mejor por dist:{" "}
              {dists
                .map((dd) => `${dd} ${uiUnit(d)}: ${records[dd].ratio.toFixed(2)} (${records[dd].strokes}/${records[dd].balls})`)
                .join(" · ")}
            </div>
          )}
        </div>
      );
    }
    if (d.format === "RATIO_HIGHER") {
      const r = lvl.bestRatio;
      return (
        <div className="text-[10px] mt-1 gf-mono">
          {r ? (
            <span>
              Mejor sesión: <strong>{(r.ratio * 100).toFixed(0)}%</strong> ({r.inTarget}/{r.balls})
            </span>
          ) : (
            <span className="text-[var(--muted)]">Sin marca anterior</span>
          )}
        </div>
      );
    }
    return null;
  }

  function renderStreakInputs(d: DrillDef, e: DrillEntry) {
    const rows = e.streakRows ?? [];
    // Live: max streak por distancia
    const maxByDist: Record<number, number> = {};
    rows.forEach((r) => {
      const dd = parseFloat(r.distance);
      const ss = parseInt(r.streak);
      if (!isNaN(dd) && !isNaN(ss)) maxByDist[dd] = Math.max(maxByDist[dd] ?? 0, ss);
    });
    const dists = Object.keys(maxByDist).map(Number).sort((a, b) => a - b);

    return (
      <>
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Intentos · {d.scoreLabel}
          </label>
          {dists.length > 0 && (
            <span className="text-[10px] gf-mono">
              Sesión: {dists.map((dd) => `${dd} ${uiUnit(d)}: ${maxByDist[dd]}`).join(" · ")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted)] mb-1.5">{inputHelp(d)}</p>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 mb-1 items-center">
            <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center w-20"
              placeholder={uiUnit(d)}
              value={r.distance}
              onChange={(ev) => setStreakRow(d.type, i, "distance", ev.target.value)}
            />
            <span className="text-[10px] text-[var(--muted)]">{uiUnit(d)}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center flex-1"
              placeholder="racha"
              value={r.streak}
              onChange={(ev) => setStreakRow(d.type, i, "streak", ev.target.value)}
            />
            <button
              type="button"
              onClick={() => removeStreakRow(d.type, i)}
              className="text-[var(--red)] text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addStreakRow(d.type)}
          className="text-xs text-[var(--fairway)] mt-1"
        >
          + Agregar intento
        </button>
      </>
    );
  }

  function renderRatioLowerInputs(d: DrillDef, e: DrillEntry) {
    const rows = e.ratioLowerRows ?? [];
    // Live: ratio agregado por distancia
    const byDist: Record<number, { strokes: number; balls: number }> = {};
    rows.forEach((r) => {
      const dd = parseFloat(r.distance);
      const ss = parseInt(r.strokes);
      const bb = parseInt(r.balls);
      if (!isNaN(dd) && !isNaN(ss) && !isNaN(bb) && bb > 0) {
        const cur = byDist[dd] ?? { strokes: 0, balls: 0 };
        cur.strokes += ss;
        cur.balls += bb;
        byDist[dd] = cur;
      }
    });
    const dists = Object.keys(byDist).map(Number).sort((a, b) => a - b);

    return (
      <>
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Intentos · golpes / pelotas
          </label>
          {dists.length > 0 && (
            <span className="text-[10px] gf-mono">
              Sesión:{" "}
              {dists
                .map((dd) => {
                  const r = byDist[dd];
                  return `${dd} ${uiUnit(d)}: ${(r.strokes / r.balls).toFixed(2)} (${r.strokes}/${r.balls})`;
                })
                .join(" · ")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted)] mb-1.5">{inputHelp(d)}</p>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 mb-1 items-center">
            <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center w-16"
              placeholder="dist"
              value={r.distance}
              onChange={(ev) => setRatioLowerRow(d.type, i, "distance", ev.target.value)}
            />
            <span className="text-[10px] text-[var(--muted)]">{uiUnit(d)}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center flex-1"
              placeholder="golpes"
              value={r.strokes}
              onChange={(ev) => setRatioLowerRow(d.type, i, "strokes", ev.target.value)}
            />
            <span className="text-[10px] text-[var(--muted)]">/</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center flex-1"
              placeholder="pelotas"
              value={r.balls}
              onChange={(ev) => setRatioLowerRow(d.type, i, "balls", ev.target.value)}
            />
            <button
              type="button"
              onClick={() => removeRatioLowerRow(d.type, i)}
              className="text-[var(--red)] text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addRatioLowerRow(d.type)}
          className="text-xs text-[var(--fairway)] mt-1"
        >
          + Agregar intento
        </button>
      </>
    );
  }

  function renderRatioHigherInputs(d: DrillDef, e: DrillEntry) {
    const rows = e.ratioHigherRows ?? [];
    // Live: ratio agregado total
    let totIn = 0, totBalls = 0;
    rows.forEach((r) => {
      const it = parseInt(r.inTarget);
      const bb = parseInt(r.balls);
      if (!isNaN(it) && !isNaN(bb) && bb > 0) {
        totIn += it;
        totBalls += bb;
      }
    });
    return (
      <>
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Intentos · dentro / pelotas (desde {distToUi(d, d.defaultDistance)} {uiUnit(d)})
          </label>
          {totBalls > 0 && (
            <span className="text-[10px] gf-mono">
              Sesión: {((totIn / totBalls) * 100).toFixed(0)}% ({totIn}/{totBalls})
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted)] mb-1.5">{inputHelp(d)}</p>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 mb-1 items-center">
            <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center flex-1"
              placeholder="dentro 2PC"
              value={r.inTarget}
              onChange={(ev) => setRatioHigherRow(d.type, i, "inTarget", ev.target.value)}
            />
            <span className="text-[10px] text-[var(--muted)]">/</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center flex-1"
              placeholder="pelotas"
              value={r.balls}
              onChange={(ev) => setRatioHigherRow(d.type, i, "balls", ev.target.value)}
            />
            <button
              type="button"
              onClick={() => removeRatioHigherRow(d.type, i)}
              className="text-[var(--red)] text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addRatioHigherRow(d.type)}
          className="text-xs text-[var(--fairway)] mt-1"
        >
          + Agregar intento
        </button>
      </>
    );
  }

  function renderGoToInputs(d: DrillDef, e: DrillEntry) {
    const rows = e.goToRows ?? [];
    const tot = rows.reduce(
      (acc, r) => {
        acc.fw += parseInt(r.fw) || 0;
        acc.left += parseInt(r.left) || 0;
        acc.right += parseInt(r.right) || 0;
        return acc;
      },
      { fw: 0, left: 0, right: 0 },
    );
    const totShots = tot.fw + tot.left + tot.right;
    return (
      <>
        <div>
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Tandas · palo + izquierda / FW / derecha
            </label>
            {totShots > 0 && (
              <span className="text-[10px] gf-mono">
                FW {tot.fw}/{totShots} · {tot.left} izq · {tot.right} der
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted)] mb-1.5">{inputHelp(d)}</p>
          <div className="flex gap-2 mb-0.5 items-center">
            <span className="w-6" />
            <span className="flex-[1.6] text-center text-[9px] uppercase tracking-wider text-[var(--muted)]">Palo</span>
            <span className="flex-1 text-center text-[9px] uppercase tracking-wider text-[var(--muted)]">Izq</span>
            <span className="flex-1 text-center text-[9px] uppercase tracking-wider text-[var(--muted)]">FW</span>
            <span className="flex-1 text-center text-[9px] uppercase tracking-wider text-[var(--muted)]">Der</span>
            <span className="w-7" />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 mb-1 items-center">
              <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
              <select
                className="gf-input !p-2 !text-xs flex-[1.6]"
                value={r.club}
                onChange={(ev) => setGoToRow(d.type, i, "club", ev.target.value)}
              >
                {GO_TO_CLUB_LADDER.map((c) => (
                  <option key={c} value={c}>{CLUB_LABEL[c] ?? c}</option>
                ))}
              </select>
              <input
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="gf-input !p-2 text-center flex-1"
                placeholder="izq"
                value={r.left}
                onChange={(ev) => setGoToRow(d.type, i, "left", ev.target.value)}
              />
              <input
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="gf-input !p-2 text-center flex-1"
                placeholder="fw"
                value={r.fw}
                onChange={(ev) => setGoToRow(d.type, i, "fw", ev.target.value)}
              />
              <input
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="gf-input !p-2 text-center flex-1"
                placeholder="der"
                value={r.right}
                onChange={(ev) => setGoToRow(d.type, i, "right", ev.target.value)}
              />
              <button
                type="button"
                onClick={() => removeGoToRow(d.type, i)}
                className="text-[var(--red)] text-xs px-2 w-7"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addGoToRow(d.type)}
            className="text-xs text-[var(--fairway)] mt-1"
          >
            + Agregar intento
          </button>
        </div>
      </>
    );
  }

  function renderLegacyInputs(d: DrillDef, e: DrillEntry, lvl?: LevelInfo) {
    const rows = e.legacyRows ?? [];
    void lvl;
    return (
      <>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Intentos · {d.scoreLabel}
          </label>
          <p className="text-[11px] text-[var(--muted)] mb-1.5">{inputHelp(d)}</p>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 mb-1 items-center">
              <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                className="gf-input !p-2 text-center flex-1"
                placeholder={`0-${d.scoreOf}`}
                value={r.value}
                onChange={(ev) => setLegacyRow(d.type, i, ev.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLegacyRow(d.type, i)}
                className="text-[var(--red)] text-xs px-2"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addLegacyRow(d.type)}
            className="text-xs text-[var(--fairway)] mt-1"
          >
            + Agregar intento
          </button>
        </div>
      </>
    );
  }
}
