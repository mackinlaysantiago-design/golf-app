"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

type Task = {
  id: string;
  sourceType: string;
  code: string;
  label: string;
  description: string | null;
  timesToAchieve: number;
  timesCompleted: number;
  status: string;
  createdAt: string;
  round: { id: string; date: string; course: { name: string } } | null;
  rangeSession: { id: string; date: string; club: string } | null;
};

export default function PendingTasks({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function markDone(id: string) {
    setBusy(id);
    const res = await fetch(`/api/practice-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("¿Eliminar esta tarea? Se borra definitivamente (no queda en historial).")) return;
    setBusy(id);
    const res = await fetch(`/api/practice-tasks/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  async function deleteAllPending() {
    if (!confirm(`¿Eliminar TODAS las ${tasks.length} tareas pendientes? Se borran definitivamente.`)) return;
    setBusy("__all__");
    const res = await fetch(`/api/practice-tasks?status=PENDING`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <Card className="text-center text-sm text-[var(--muted)] !p-3">
        Sin tareas pendientes — entrá una ronda o sesión FlightScope para
        generar nuevas
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={deleteAllPending}
          disabled={busy === "__all__"}
          className="text-[10px] text-[var(--muted)] hover:text-[var(--red)] underline"
        >
          {busy === "__all__" ? "Eliminando…" : `🗑 Eliminar todas (${tasks.length})`}
        </button>
      </div>
      {tasks.map((t) => {
        const pct = t.timesToAchieve > 0 ? Math.round((t.timesCompleted / t.timesToAchieve) * 100) : 0;
        const isFlightScope = t.sourceType === "RANGE_SESSION";
        const sourceLabel = isFlightScope
          ? `FlightScope · ${t.rangeSession?.club ?? ""}`
          : t.round
          ? `Ronda · ${t.round.course.name} · ${new Date(t.round.date).toLocaleDateString("es-AR")}`
          : "—";
        const ctaHref = isFlightScope
          ? `/range/${t.rangeSession?.id}`
          : "/range/pp/nueva";
        const ctaLabel = isFlightScope ? "Ver análisis" : "Practicar";

        return (
          <Card
            key={t.id}
            className="!p-3 space-y-2"
            style={{ borderLeft: "4px solid var(--accent)" }}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-[10px] text-[var(--muted)] gf-mono mt-0.5">
                  {sourceLabel}
                </div>
                {t.description && (
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    {t.description}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="gf-display text-2xl text-[var(--accent)]">
                  {t.timesCompleted}/{t.timesToAchieve}
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: "var(--green-pale)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${pct}%`,
                  background: "var(--accent)",
                  transition: "width 200ms",
                }}
              />
            </div>
            <div className="flex gap-2">
              <Link
                href={ctaHref}
                className="gf-btn gf-btn-secondary !text-xs !py-1.5 flex-1 text-center"
              >
                {ctaLabel}
              </Link>
              <button
                onClick={() => markDone(t.id)}
                disabled={busy === t.id}
                className="gf-btn !text-xs !py-1.5 flex-1"
              >
                ✓ Completar
              </button>
              <button
                onClick={() => deleteTask(t.id)}
                disabled={busy === t.id}
                className="text-[var(--muted)] text-xs px-2 hover:text-[var(--red)]"
                title="Eliminar definitivamente"
              >
                ✕
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
