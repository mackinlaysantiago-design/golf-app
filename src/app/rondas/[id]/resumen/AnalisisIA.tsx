"use client";

import { useState } from "react";
import { Card, SectionHeader } from "@/components/ui/Card";

const MIN_HOLES = 5;

export default function AnalisisIA({
  roundId,
  holesPlayed,
}: {
  roundId: string;
  holesPlayed: number;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughHoles = holesPlayed >= MIN_HOLES;

  async function generar() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/analyze-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId }),
    });
    if (res.ok) {
      const data = await res.json();
      setAnalysis(data.analysis);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error generando análisis");
    }
    setBusy(false);
  }

  return (
    <>
      <SectionHeader>Análisis IA · Coach</SectionHeader>
      {!analysis && (
        <Card className="text-center space-y-2">
          <button
            className="gf-btn"
            onClick={generar}
            disabled={busy || !enoughHoles}
          >
            {busy ? "Pensando..." : "🤖 Pedir análisis a Claude"}
          </button>
          {!enoughHoles && (
            <p className="text-xs text-[var(--muted)]">
              Cargá al menos {MIN_HOLES} hoyos para tener un PP útil ({holesPlayed}/{MIN_HOLES})
            </p>
          )}
          {error && <p className="text-xs text-[var(--red)] mt-2">{error}</p>}
        </Card>
      )}
      {analysis && (
        <Card>
          <div
            className="prose prose-sm max-w-none"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {analysis}
          </div>
        </Card>
      )}
    </>
  );
}
