"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { formatLevel, type SmField } from "@/lib/sm-levels";

export type PerfectRun = {
  field: SmField;
  label: string;
  current: number;
  next: number;
  cumplidos: number;
  total: number;
};

export default function LevelUpCard({
  playerId,
  perfectRuns,
  alreadyApplied,
}: {
  playerId: string;
  perfectRuns: PerfectRun[];
  alreadyApplied: SmField[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<SmField | null>(null);
  const [done, setDone] = useState<SmField[]>(alreadyApplied);

  if (perfectRuns.length === 0) return null;

  async function levelUp(p: PerfectRun) {
    setBusy(p.field);
    const res = await fetch(`/api/jugadores/${playerId}/level-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: p.field, newValue: p.next }),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Error subiendo nivel");
      return;
    }
    setDone((prev) => [...prev, p.field]);
    router.refresh();
  }

  return (
    <>
      <div className="gf-section-header" style={{ background: "var(--accent)" }}>
        🏆 Logros — Perfect Run
      </div>
      <div className="space-y-2">
        {perfectRuns.map((p) => {
          const applied = done.includes(p.field);
          return (
            <Card
              key={p.field}
              className="!p-3"
              style={{ borderLeft: "4px solid var(--accent)" }}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {p.label}
                    <span className="gf-pill text-[10px]">
                      {p.cumplidos}/{p.total}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Cumpliste el target en TODOS los hoyos con datos. Subí el
                    listón:
                  </div>
                  <div className="gf-mono text-sm mt-1">
                    <span className="text-[var(--muted)] line-through">
                      {formatLevel(p.field, p.current)}
                    </span>{" "}
                    →{" "}
                    <span className="font-bold text-[var(--fairway)]">
                      {formatLevel(p.field, p.next)}
                    </span>
                  </div>
                </div>
                {applied ? (
                  <span className="gf-pill text-[10px] gf-pill-accent">
                    ✓ Aplicado
                  </span>
                ) : (
                  <button
                    onClick={() => levelUp(p)}
                    disabled={busy === p.field}
                    className="gf-btn !text-xs !px-3 !py-1.5"
                  >
                    {busy === p.field ? "..." : "Subir nivel"}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
