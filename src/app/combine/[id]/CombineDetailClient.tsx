"use client";

import { useEffect, useState } from "react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { COMBINE_TESTS, type CombineTestType } from "@/lib/combine";

type TestDetail = {
  type: CombineTestType;
  label: string;
  icon: string;
  protocol: string;
  successCriteria: string;
  attempts: boolean[];
  score: number;
};

type Detail = {
  id: string;
  date: string;
  notes: string | null;
  player: { id: string; name: string };
  tests: TestDetail[];
  totalScore: number;
};

const MAX_TOTAL = COMBINE_TESTS.length * 10;

export default function CombineDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [notFoundErr, setNotFoundErr] = useState(false);

  useEffect(() => {
    fetch(`/api/combine/${id}`, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) {
        setNotFoundErr(true);
        return;
      }
      setData(await res.json());
    });
  }, [id]);

  if (notFoundErr) return <p className="text-sm text-[var(--red)] px-1">No se encontró esa sesión del Combine.</p>;
  if (!data) return <p className="text-sm text-[var(--muted)] px-1">Cargando...</p>;

  return (
    <div className="space-y-4">
      <Card variant="fairway" className="!p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-white/70">
          {new Date(data.date).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
        <div className="gf-display text-5xl text-white mt-1">{data.totalScore}</div>
        <div className="text-xs text-white/70 gf-mono">de {MAX_TOTAL}</div>
      </Card>

      <SectionHeader>Por test</SectionHeader>
      <div className="space-y-2">
        {data.tests.map((t) => (
          <Card key={t.type} className="!p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--fairway)]">
                {t.icon} {t.label}
              </div>
              <div className="gf-display text-2xl text-[var(--ink)]">
                {t.score}
                <span className="text-xs text-[var(--muted)] gf-mono"> /10</span>
              </div>
            </div>
            <div className="text-[11px] text-[var(--muted)]">{t.successCriteria}</div>
            <div className="flex gap-1">
              {t.attempts.map((hit, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-md text-center text-[10px] py-1 font-bold"
                  style={
                    hit
                      ? { background: "var(--green-pale)", color: "var(--green)" }
                      : { background: "var(--sand)", color: "var(--muted)" }
                  }
                >
                  {hit ? "✓" : "✕"}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {data.notes && (
        <>
          <SectionHeader>Notas</SectionHeader>
          <p className="text-sm text-[var(--ink)] px-1">{data.notes}</p>
        </>
      )}
    </div>
  );
}
