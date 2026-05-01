"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DRILLS, type DrillType } from "@/lib/pp-drills";

type DrillEntry = {
  enabled: boolean;
  distance: string;
  attempts: string;
  successes: string;
  notes: string;
};

export default function NuevaPPPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const initial: Record<DrillType, DrillEntry> = Object.fromEntries(
    DRILLS.map((d) => [
      d.type,
      {
        enabled: false,
        distance: String(d.defaultDistance),
        attempts: String(d.defaultAttempts),
        successes: "",
        notes: "",
      },
    ]),
  ) as Record<DrillType, DrillEntry>;

  const [drills, setDrills] = useState(initial);

  function update(type: DrillType, field: keyof DrillEntry, value: string | boolean) {
    setDrills((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  }

  async function save() {
    setBusy(true);
    const drillsArr = DRILLS.filter((d) => drills[d.type].enabled).map((d) => {
      const e = drills[d.type];
      return {
        drillType: d.type,
        distance: e.distance ? parseInt(e.distance) : null,
        attempts: e.attempts ? parseInt(e.attempts) : null,
        successes: e.successes ? parseInt(e.successes) : null,
        bestScore: null,
        notes: e.notes || null,
      };
    });

    if (drillsArr.length === 0) {
      alert("Marcá al menos un drill para guardar");
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
          Marcá los drills que hiciste y cargá el resultado
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
                <div className="font-semibold text-sm">{d.label}</div>
                <div className="text-[11px] text-[var(--muted)]">{d.description}</div>
              </div>
            </label>

            {e.enabled && (
              <div className="space-y-2 pl-6">
                <div className="grid grid-cols-3 gap-2">
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
                      Intentos
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="gf-input mt-0.5 text-center"
                      value={e.attempts}
                      onChange={(ev) => update(d.type, "attempts", ev.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Score
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="gf-input mt-0.5 text-center"
                      placeholder={d.scoreLabel.split(" ").slice(0, 2).join(" ")}
                      value={e.successes}
                      onChange={(ev) => update(d.type, "successes", ev.target.value)}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[var(--muted)]">
                  Score = {d.scoreLabel}
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
