"use client";

import { useState } from "react";
import { Card, SectionHeader } from "@/components/ui/Card";

export default function AnalisisIA({ roundId }: { roundId: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Card className="text-center">
          <button
            className="gf-btn"
            onClick={generar}
            disabled={busy}
          >
            {busy ? "Pensando..." : "🤖 Pedir análisis a Claude"}
          </button>
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
