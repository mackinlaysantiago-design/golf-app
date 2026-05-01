"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DRILLS, meetsTarget, type DrillType } from "@/lib/pp-drills";

type DrillEntry = {
  enabled: boolean;
  distance: string;
  target: string;
  attempts: string[]; // strings para permitir vacíos al editar
  notes: string;
};

export default function NuevaPPPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [bestMarks, setBestMarks] = useState<Record<string, { best: number | null; lastDate: string | null }>>({});

  const initial: Record<DrillType, DrillEntry> = Object.fromEntries(
    DRILLS.map((d) => [
      d.type,
      {
        enabled: false,
        distance: String(d.defaultDistance),
        target: String(d.defaultTarget),
        attempts: [""],
        notes: "",
      },
    ]),
  ) as Record<DrillType, DrillEntry>;

  const [drills, setDrills] = useState(initial);

  // Cargar mejores marcas históricas
  useEffect(() => {
    fetch("/api/pp/best-marks")
      .then((r) => r.json())
      .then(setBestMarks)
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
        ppCode: d.ppCode,
        target: e.target ? parseFloat(e.target) : null,
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
          Marcá los drills que hiciste, agregá tantos intentos como quieras.
        </p>
      </header>

      <Card className="space-y-2">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Fecha
          </label>
          <input
            type="date"
            className="gf-input mt-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Notas (opcional)
          </label>
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
        const best = bestMarks[d.type]?.best;
        const validAttempts = e.attempts
          .map((a) => parseFloat(a))
          .filter((n) => !isNaN(n));
        const targetNum = parseFloat(e.target);
        const cumple = !isNaN(targetNum) && validAttempts.length > 0
          ? meetsTarget(d, validAttempts, targetNum)
          : false;
        const bestThisSession = validAttempts.length > 0
          ? d.scoring === "SUM_LOWEST"
            ? validAttempts.reduce((a, b) => a + b, 0)
            : Math.max(...validAttempts)
          : null;

        return (
          <Card key={d.type} className="space-y-2">
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
                {best != null && (
                  <div className="text-[10px] text-[var(--accent)] gf-mono mt-0.5">
                    Mejor marca histórica: {best}
                    {d.scoring === "PCT_HITS" && `/${d.scoreOf}`}
                  </div>
                )}
              </div>
            </label>

            {e.enabled && (
              <div className="space-y-2 pl-6">
                <div className="grid grid-cols-2 gap-2">
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
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Target {d.scoring === "PCT_HITS" ? "(% acierto)" : "(suma máx)"}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className="gf-input mt-0.5 text-center"
                      value={e.target}
                      onChange={(ev) => update(d.type, "target", ev.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Intentos · {d.scoreLabel}
                    </label>
                    {bestThisSession != null && (
                      <span className="text-[10px] gf-mono">
                        {d.scoring === "SUM_LOWEST" ? "Suma" : "Mejor"}: {bestThisSession}
                        {cumple && " 🎯"}
                      </span>
                    )}
                  </div>
                  {e.attempts.map((a, i) => (
                    <div key={i} className="flex gap-2 mb-1">
                      <span className="text-[10px] text-[var(--muted)] gf-mono w-6 self-center text-right">
                        #{i + 1}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="gf-input !p-2 text-center flex-1"
                        placeholder={d.scoring === "PCT_HITS" ? `0-${d.scoreOf}` : "golpes"}
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
