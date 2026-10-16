"use client";

import { useEffect, useState } from "react";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  COMBINE_NOMINAL_TOTAL,
  lagPuttDistanceFt,
  wedgeTargetYds,
  type ChipStrokes,
  type CombineTestType,
  type LagPuttOutcome,
} from "@/lib/combine";

type TestDetail = {
  type: CombineTestType;
  label: string;
  icon: string;
  setup: string;
  data: unknown;
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
        <div className="text-xs text-white/70 gf-mono">de {COMBINE_NOMINAL_TOTAL}</div>
      </Card>

      <SectionHeader>Por test</SectionHeader>
      <div className="space-y-2">
        {data.tests.map((t) => (
          <Card key={t.type} className="!p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--fairway)]">
                {t.icon} {t.label}
              </div>
              <div className="gf-display text-2xl text-[var(--ink)]">{t.score}</div>
            </div>
            <div className="text-[11px] text-[var(--muted)]">{t.setup}</div>
            <TestAttempts type={t.type} data={t.data} />
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

function pill(label: string, ok: boolean | null) {
  return (
    <span
      className="flex-1 rounded-md text-center text-[10px] py-1 font-bold"
      style={
        ok == null
          ? { background: "var(--sand)", color: "var(--muted)" }
          : ok
          ? { background: "var(--green-pale)", color: "var(--green)" }
          : { background: "var(--sand)", color: "var(--muted)" }
      }
    >
      {label}
    </span>
  );
}

function TestAttempts({ type, data }: { type: CombineTestType; data: unknown }) {
  if (!data) return null;

  if (type === "SHORT_PUTTS") {
    const hits = (data as { hits: boolean[] }).hits;
    return <div className="flex gap-1">{hits.map((h, i) => <span key={i}>{pill(h ? "✓" : "✕", h)}</span>)}</div>;
  }

  if (type === "DRIVER") {
    const hits = (data as { hits: boolean[]; carryYds: number }).hits;
    return <div className="flex gap-1">{hits.map((h, i) => <span key={i}>{pill(h ? "✓" : "✕", h)}</span>)}</div>;
  }

  if (type === "WEDGES") {
    const d = data as { hits: boolean[]; customDistanceYds: number };
    return (
      <div className="flex gap-1">
        {d.hits.map((h, i) => (
          <span key={i} className="flex-1 flex flex-col items-center">
            {pill(`${wedgeTargetYds(i, d.customDistanceYds)}y`, h)}
          </span>
        ))}
      </div>
    );
  }

  if (type === "LAG_PUTTS") {
    const outcomes = (data as { outcomes: LagPuttOutcome[] }).outcomes;
    const LABEL: Record<LagPuttOutcome, string> = { HOLED: "●", CIRCLE: "○", OUT: "✕" };
    return (
      <div className="flex gap-1">
        {outcomes.map((o, i) => (
          <span key={i} title={`${lagPuttDistanceFt(i)}ft`}>
            {pill(LABEL[o], o === "OUT" ? false : true)}
          </span>
        ))}
      </div>
    );
  }

  if (type === "CHIPPING") {
    const strokes = (data as { strokes: ChipStrokes[] }).strokes;
    return (
      <div className="flex gap-1">
        {strokes.map((n, i) => (
          <span key={i}>{pill(n === 4 ? "4+" : String(n), n <= 2)}</span>
        ))}
      </div>
    );
  }

  return null;
}
