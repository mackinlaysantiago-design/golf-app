"use client";

import { useEffect, useState } from "react";
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
} from "@/lib/pp-drills";

// Estado de input por drill: vamos a usar shapes distintos por formato.
// Para simplificar, manejamos un único objeto por drill.
type StreakRow = { distance: string; streak: string };
type RatioLowerRow = { distance: string; strokes: string; balls: string };
type RatioHigherRow = { inTarget: string; balls: string };
type LegacyRow = { value: string };

type DrillEntry = {
  enabled: boolean;
  // Streak
  streakRows?: StreakRow[];
  // RatioLower
  ratioLowerRows?: RatioLowerRow[];
  // RatioHigher
  ratioHigherRows?: RatioHigherRow[];
  // Legacy (Go-To Club): cada intento es un score 0-9
  legacyRows?: LegacyRow[];
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
  const base = {
    enabled: false,
    distance: String(d.defaultDistance),
    club: d.type === "GO_TO_CLUB" ? GO_TO_CLUB_LADDER[0] : "",
    timesToAchieve: "1",
    notes: "",
  };
  if (d.format === "STREAK_BY_DIST") {
    return { ...base, streakRows: [{ distance: String(d.defaultDistance), streak: "" }] };
  }
  if (d.format === "RATIO_LOWER_BY_DIST") {
    return { ...base, ratioLowerRows: [{ distance: String(d.defaultDistance), strokes: "", balls: "" }] };
  }
  if (d.format === "RATIO_HIGHER") {
    return { ...base, ratioHigherRows: [{ inTarget: "", balls: "" }] };
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
  // Drills preseleccionados desde el wizard de /range/pp/setup (?drills=t1,t2,...)
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

  useEffect(() => {
    Promise.all([
      fetch("/api/pp/levels").then((r) => r.json()),
      fetch("/api/pp/plan").then((r) => r.json()),
    ])
      .then(([levelsData, planData]) => {
        setLevels(levelsData);
        setPlan(planData);
        const targets: Record<string, { timesToAchieve: number; ppCode: string }> =
          planData.drillTargets ?? {};

        setDrills((prev) => {
          const next = { ...prev };
          for (const drill of DRILLS) {
            const lvl = levelsData[drill.type];
            const planTarget = targets[drill.type];
            // Pre-llenar distancia inicial con nivel actual
            if (lvl?.currentDistance != null) {
              const dStr = String(lvl.currentDistance);
              next[drill.type] = { ...next[drill.type], distance: dStr };
              if (drill.format === "STREAK_BY_DIST") {
                next[drill.type].streakRows = [{ distance: dStr, streak: "" }];
              }
              if (drill.format === "RATIO_LOWER_BY_DIST") {
                next[drill.type].ratioLowerRows = [{ distance: dStr, strokes: "", balls: "" }];
              }
            }
            if (lvl?.currentClub) {
              next[drill.type] = { ...next[drill.type], club: lvl.currentClub };
            }
            if (planTarget) {
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
        const rows = (e.streakRows ?? [])
          .map((r) => ({ distance: parseFloat(r.distance), streak: parseInt(r.streak) }))
          .filter((r) => !isNaN(r.distance) && !isNaN(r.streak));
        attempts = { type: "STREAK_BY_DIST", attempts: rows };
      } else if (d.format === "RATIO_LOWER_BY_DIST") {
        const rows = (e.ratioLowerRows ?? [])
          .map((r) => ({ distance: parseFloat(r.distance), strokes: parseInt(r.strokes), balls: parseInt(r.balls) }))
          .filter((r) => !isNaN(r.distance) && !isNaN(r.strokes) && !isNaN(r.balls) && r.balls > 0);
        attempts = { type: "RATIO_LOWER_BY_DIST", attempts: rows };
      } else if (d.format === "RATIO_HIGHER") {
        const rows = (e.ratioHigherRows ?? [])
          .map((r) => ({ inTarget: parseInt(r.inTarget), balls: parseInt(r.balls) }))
          .filter((r) => !isNaN(r.inTarget) && !isNaN(r.balls) && r.balls > 0);
        attempts = { type: "RATIO_HIGHER", attempts: rows };
      } else {
        // Legacy (Go-To Club)
        const arr = (e.legacyRows ?? []).map((r) => parseInt(r.value)).filter((n) => !isNaN(n));
        attempts = arr;
      }

      return {
        drillType: d.type,
        distance: e.distance ? parseInt(e.distance) : null,
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
          Marcá los drills, agregá tantos intentos como hagas.
        </p>
      </header>

      {Object.keys(plan.drillTargets).length > 0 && (
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
        const obligatorios = DRILLS.filter((d) => !!plan.drillTargets[d.type]);
        // Áreas en orden: Putting → Chipping → Wedges → Long Game
        const AREA_ORDER: DrillArea[] = ["PUTTING", "CHIPPING", "WEDGES", "LONG_GAME"];
        // Si venís del wizard (?drills=...), solo mostramos los que elegiste.
        // Si no, mostramos todos los drills no-obligatorios agrupados por área (modo libre).
        const cameFromWizard = preselectedDrills != null;
        return (
          <>
            {/* Obligatorios primero (si hay) — del plan de la última ronda */}
            {obligatorios.length > 0 && (
              <>
                <SectionHeader>Obligatorios (del plan)</SectionHeader>
                {obligatorios.map((d) => <div key={d.type}>{renderDrill(d)}</div>)}
              </>
            )}
            {/* Drills del wizard (si venís de /range/pp/setup) */}
            {cameFromWizard && (
              (() => {
                const wizardDrills = DRILLS.filter(
                  (d) => preselectedDrills!.has(d.type) && !plan.drillTargets[d.type],
                );
                if (wizardDrills.length === 0) return null;
                return (
                  <>
                    <SectionHeader>Tus drills elegidos</SectionHeader>
                    {wizardDrills.map((d) => <div key={d.type}>{renderDrill(d)}</div>)}
                  </>
                );
              })()
            )}
            {/* Modo libre: por área. Solo si NO venís del wizard */}
            {!cameFromWizard && AREA_ORDER.map((area) => {
              const drillsInArea = DRILLS.filter(
                (d) => d.area === area && !plan.drillTargets[d.type],
              );
              if (drillsInArea.length === 0) return null;
              return (
                <div key={area}>
                  <SectionHeader>{DRILL_AREA_LABEL[area]}</SectionHeader>
                  {drillsInArea.map((d) => <div key={d.type}>{renderDrill(d)}</div>)}
                </div>
              );
            })}
          </>
        );
      })()}

      <button onClick={save} disabled={busy} className="gf-btn w-full">
        {busy ? "Guardando..." : "💾 Guardar sesión"}
      </button>
    </div>
  );

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
            {d.format === "STREAK_BY_DIST" && renderStreakInputs(d, e)}
            {d.format === "RATIO_LOWER_BY_DIST" && renderRatioLowerInputs(d, e)}
            {d.format === "RATIO_HIGHER" && renderRatioHigherInputs(d, e)}
            {d.format === "LEGACY_NUMBER_ARRAY" && renderLegacyInputs(d, e, lvl)}
          </div>
        )}
      </Card>
    );
  }

  function renderLevelInfo(d: DrillDef, lvl?: LevelInfo) {
    if (!lvl) return null;
    if (d.type === "GO_TO_CLUB") {
      return (
        <div className="text-[10px] mt-1 gf-mono">
          Practicar con: <strong>{CLUB_LABEL[drills[d.type].club] ?? drills[d.type].club}</strong>
          {lvl.currentClub && (
            <span className="text-[var(--muted)] ml-1">
              (nivel actual: {CLUB_LABEL[lvl.currentClub]})
            </span>
          )}
        </div>
      );
    }
    if (d.format === "STREAK_BY_DIST") {
      const records = lvl.bestStreakByDist ?? {};
      const dists = Object.keys(records).map(Number).sort((a, b) => a - b);
      return (
        <div className="text-[10px] mt-1 gf-mono">
          Nivel actual: <strong>{lvl.currentDistance}{d.distanceUnit}</strong>
          {dists.length > 0 && (
            <div className="text-[var(--muted)]">
              Récords: {dists.map((dd) => `${dd}${d.distanceUnit}: ${records[dd]}`).join(" · ")}
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
                .map((dd) => `${dd}${d.distanceUnit}: ${records[dd].ratio.toFixed(2)} (${records[dd].strokes}/${records[dd].balls})`)
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
              Sesión: {dists.map((dd) => `${dd}${d.distanceUnit}: ${maxByDist[dd]}`).join(" · ")}
            </span>
          )}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 mb-1 items-center">
            <span className="text-[10px] text-[var(--muted)] gf-mono w-6 text-right">#{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              className="gf-input !p-2 text-center w-20"
              placeholder={d.distanceUnit}
              value={r.distance}
              onChange={(ev) => setStreakRow(d.type, i, "distance", ev.target.value)}
            />
            <span className="text-[10px] text-[var(--muted)]">{d.distanceUnit}</span>
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
                  return `${dd}${d.distanceUnit}: ${(r.strokes / r.balls).toFixed(2)} (${r.strokes}/${r.balls})`;
                })
                .join(" · ")}
            </span>
          )}
        </div>
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
            <span className="text-[10px] text-[var(--muted)]">{d.distanceUnit}</span>
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
            Intentos · dentro / pelotas (desde {d.defaultDistance}{d.distanceUnit})
          </label>
          {totBalls > 0 && (
            <span className="text-[10px] gf-mono">
              Sesión: {((totIn / totBalls) * 100).toFixed(0)}% ({totIn}/{totBalls})
            </span>
          )}
        </div>
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

  function renderLegacyInputs(d: DrillDef, e: DrillEntry, lvl?: LevelInfo) {
    const rows = e.legacyRows ?? [];
    return (
      <>
        {d.type === "GO_TO_CLUB" && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Palo</label>
            <select
              className="gf-input mt-0.5"
              value={e.club}
              onChange={(ev) => update(d.type, "club", ev.target.value)}
            >
              {GO_TO_CLUB_LADDER.map((c) => (
                <option key={c} value={c}>
                  {CLUB_LABEL[c] ?? c}
                  {lvl?.currentClub === c ? " · nivel actual" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Intentos · {d.scoreLabel}
          </label>
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
