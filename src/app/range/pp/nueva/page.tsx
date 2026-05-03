"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  DRILLS,
  GO_TO_CLUB_LADDER,
  CLUB_LABEL,
  setScore,
  type DrillType,
} from "@/lib/pp-drills";

type DrillEntry = {
  enabled: boolean;
  distance: string;
  club: string;
  timesToAchieve: string; // veces a lograr el target (del PP plan)
  attempts: string[];
  notes: string;
};

type LevelInfo = {
  drillType: DrillType;
  currentDistance?: number;
  currentClub?: string;
  bestAtCurrent: number | null;
  bestEver: number | null;
};

type PlanInfo = {
  drillTargets: Record<string, { timesToAchieve: number; ppCode: string }>;
  lastRoundDate?: string;
  lastRoundCourse?: string;
};

export default function NuevaPPPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<Record<string, LevelInfo>>({});
  const [plan, setPlan] = useState<PlanInfo>({ drillTargets: {} });

  const initial: Record<DrillType, DrillEntry> = Object.fromEntries(
    DRILLS.map((d) => [
      d.type,
      {
        enabled: false,
        distance: String(d.defaultDistance),
        club: d.type === "GO_TO_CLUB" ? GO_TO_CLUB_LADDER[0] : "",
        timesToAchieve: "1",
        attempts: [""],
        notes: "",
      },
    ]),
  ) as Record<DrillType, DrillEntry>;

  const [drills, setDrills] = useState(initial);

  // Cargar niveles actuales + plan de la última ronda
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
            // Pre-llenar distancias/palos con nivel actual
            if (lvl?.currentDistance != null) {
              next[drill.type] = { ...next[drill.type], distance: String(lvl.currentDistance) };
            }
            if (lvl?.currentClub) {
              next[drill.type] = { ...next[drill.type], club: lvl.currentClub };
            }
            // Pre-tildar y setear timesToAchieve si está en el plan
            if (planTarget) {
              next[drill.type] = {
                ...next[drill.type],
                enabled: true,
                timesToAchieve: String(planTarget.timesToAchieve),
              };
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, []);

  function update(type: DrillType, field: keyof DrillEntry, value: string | boolean | string[]) {
    setDrills((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  }

  function setAttempt(type: DrillType, idx: number, value: string) {
    const next = [...drills[type].attempts];
    next[idx] = value;
    update(type, "attempts", next);
  }
  function addAttempt(type: DrillType) {
    update(type, "attempts", [...drills[type].attempts, ""]);
  }
  function removeAttempt(type: DrillType, idx: number) {
    const next = drills[type].attempts.filter((_, i) => i !== idx);
    update(type, "attempts", next.length > 0 ? next : [""]);
  }

  async function save() {
    setBusy(true);
    const drillsArr = DRILLS.filter((d) => drills[d.type].enabled).map((d) => {
      const e = drills[d.type];
      const attempts = e.attempts
        .map((a) => parseFloat(a))
        .filter((n) => !isNaN(n));
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
        <h1 className="gf-display text-3xl text-[var(--fairway)]">
          Nueva sesión PP
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Marcá los drills, agregá tantos intentos como hagas. La app detecta si cumpliste el plan.
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
                  <span className="gf-mono font-bold">
                    {t.timesToAchieve}× lograr target
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--muted)] mt-2">
            Los drills sugeridos están pre-tildados. Si compartís un PP code (ej B), elegí cuál de los drills hacer.
          </p>
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

      <SectionHeader>Drills</SectionHeader>
      {DRILLS.map((d) => {
        const e = drills[d.type];
        const lvl = levels[d.type];
        const validAttempts = e.attempts.map((a) => parseFloat(a)).filter((n) => !isNaN(n));
        const bestPrevious = lvl?.bestAtCurrent ?? null;
        const score = setScore(d.scoring, validAttempts);

        // timesAchieved en vivo
        let timesAchieved = 0;
        if (d.scoring === "PCT_HITS_PERFECT") {
          timesAchieved = validAttempts.filter((a) => a === d.scoreOf).length;
        } else if (d.scoring === "BEAT_BEST_HIGHER") {
          const threshold = bestPrevious ?? 0;
          timesAchieved = validAttempts.filter((a) => a > threshold).length;
        } else if (d.scoring === "BEAT_BEST_LOWER_BY_1") {
          if (validAttempts.length > 0 && bestPrevious != null) {
            const sum = validAttempts.reduce((a, b) => a + b, 0);
            if (sum <= bestPrevious - 1) timesAchieved = 1;
          }
        }
        const timesToAchieveNum = parseInt(e.timesToAchieve) || 1;
        const planComplete = timesAchieved >= timesToAchieveNum;
        const inPlan = !!plan.drillTargets[d.type];

        return (
          <Card
            key={d.type}
            className="space-y-2"
            style={
              planComplete && validAttempts.length > 0
                ? { borderLeft: "4px solid var(--green)" }
                : inPlan
                ? { borderLeft: "4px solid var(--accent)" }
                : undefined
            }
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
                </div>
                <div className="text-[11px] text-[var(--muted)]">{d.description}</div>
                {lvl && (
                  <div className="text-[10px] mt-1 gf-mono">
                    {d.type === "GO_TO_CLUB" ? (
                      <span>
                        Practicar con: <strong>{CLUB_LABEL[e.club] ?? e.club}</strong>
                        {lvl.currentClub && (
                          <span className="text-[var(--muted)] ml-1">
                            (nivel actual: {CLUB_LABEL[lvl.currentClub]})
                          </span>
                        )}
                      </span>
                    ) : d.distanceStep ? (
                      <span>
                        Nivel actual: <strong>{lvl.currentDistance}{d.distanceUnit}</strong>
                        {bestPrevious != null && (
                          <span className="text-[var(--muted)] ml-1">
                            · mejor a esta dist: {bestPrevious}/{d.scoreOf}
                          </span>
                        )}
                      </span>
                    ) : bestPrevious != null ? (
                      <span>
                        Mejor marca histórica:{" "}
                        <strong>
                          {bestPrevious}
                          {d.scoring === "BEAT_BEST_HIGHER" && `/${d.scoreOf}`}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">Sin marca anterior</span>
                    )}
                  </div>
                )}
              </div>
            </label>

            {e.enabled && (
              <div className="space-y-2 pl-6">
                <div className="grid grid-cols-2 gap-2">
                  {d.type === "GO_TO_CLUB" ? (
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Palo a practicar
                      </label>
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
                  ) : (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Distancia ({d.distanceUnit})
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="gf-input mt-0.5 text-center"
                        value={e.distance}
                        onChange={(ev) => update(d.type, "distance", ev.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Veces a lograr el target
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="gf-input !w-16 !p-1 text-center text-sm"
                      value={e.timesToAchieve}
                      onChange={(ev) => update(d.type, "timesToAchieve", ev.target.value)}
                    />
                    <span
                      className="ml-auto gf-pill text-[10px] gf-mono"
                      style={{
                        background: planComplete ? "#d4f4dd" : "var(--green-pale)",
                        color: planComplete ? "var(--green)" : "var(--fairway)",
                        fontWeight: 700,
                      }}
                    >
                      {timesAchieved}/{timesToAchieveNum} {planComplete ? "🎯" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Intentos · {d.scoreLabel}
                    </label>
                    {score != null && (
                      <span className="text-[10px] gf-mono">
                        {d.scoring === "BEAT_BEST_LOWER_BY_1" ? "Suma" : "Mejor"}: {score}
                      </span>
                    )}
                  </div>
                  {e.attempts.map((a, i) => (
                    <div key={i} className="flex gap-2 mb-1">
                      <span className="text-[10px] text-[var(--muted)] gf-mono w-6 self-center text-right">
                        {d.scoring === "BEAT_BEST_LOWER_BY_1" ? `B${i + 1}` : `#${i + 1}`}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="gf-input !p-2 text-center flex-1"
                        placeholder={
                          d.scoring === "BEAT_BEST_LOWER_BY_1"
                            ? "golpes"
                            : `0-${d.scoreOf}`
                        }
                        value={a}
                        onChange={(ev) => setAttempt(d.type, i, ev.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeAttempt(d.type, i)}
                        className="text-[var(--red)] text-xs px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAttempt(d.type)}
                    className="text-xs text-[var(--fairway)] mt-1"
                  >
                    + Agregar intento
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <button onClick={save} disabled={busy} className="gf-btn w-full">
        {busy ? "Guardando..." : "💾 Guardar sesión"}
      </button>
    </div>
  );
}
