"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui/Card";
import { COMBINE_NOMINAL_TOTAL, COMBINE_TEST_ORDER, type CombineTestType } from "@/lib/combine";

const SHORT_LABEL: Record<CombineTestType, string> = {
  SHORT_PUTTS: "Putts",
  LAG_PUTTS: "Lag",
  CHIPPING: "Chip",
  WEDGES: "Wedges",
  DRIVER: "Driver",
};

type SessionSummary = {
  id: string;
  date: string;
  notes: string | null;
  scores: Record<CombineTestType, number>;
  totalScore: number;
};

export default function CombineClient() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/combine", { cache: "no-store" });
    if (res.ok) setSessions((await res.json()).sessions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Link href="/combine/nuevo" className="block">
        <Card className="!p-4 flex items-center justify-between hover:shadow-lg transition-shadow" style={{ borderLeft: "4px solid var(--accent)" }}>
          <div>
            <div className="font-bold text-base text-[var(--fairway)]">🏁 Correr el Combine</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              {COMBINE_TEST_ORDER.length} tests · 10 intentos cada uno
            </div>
          </div>
          <span className="text-[var(--accent)] text-2xl">›</span>
        </Card>
      </Link>

      <SectionHeader>Historial ({sessions?.length ?? 0})</SectionHeader>

      {sessions == null && <p className="text-sm text-[var(--muted)] px-1">Cargando...</p>}
      {sessions != null && sessions.length === 0 && (
        <p className="text-sm text-[var(--muted)] px-1">Todavía no corriste ningún Combine.</p>
      )}

      <div className="space-y-2">
        {sessions?.map((s) => (
          <Link key={s.id} href={`/combine/${s.id}`} className="block">
            <Card className="!p-3 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--fairway)]">
                  {new Date(s.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <div className="gf-display text-2xl text-[var(--ink)]">
                  {s.totalScore}
                  <span className="text-xs text-[var(--muted)] gf-mono"> /{COMBINE_NOMINAL_TOTAL}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-1.5 text-[11px] text-[var(--muted)]">
                {COMBINE_TEST_ORDER.map((t) => (
                  <span key={t}>
                    {SHORT_LABEL[t]} {s.scores[t] ?? 0}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
