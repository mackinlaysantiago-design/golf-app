"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";

export default function BriefingActions({
  roundId,
  playerId,
  initialThermostatMin,
  initialThermostatMax,
  initialScoreDesired,
}: {
  roundId: string;
  playerId: string;
  initialThermostatMin: number | null;
  initialThermostatMax: number | null;
  initialScoreDesired: number | null;
}) {
  const router = useRouter();

  const [thermoMin, setThermoMin] = useState(
    initialThermostatMin?.toString() ?? "",
  );
  const [thermoMax, setThermoMax] = useState(
    initialThermostatMax?.toString() ?? "",
  );
  const [desired, setDesired] = useState(initialScoreDesired?.toString() ?? "");
  const [vizScore, setVizScore] = useState("");
  const [vizNotes, setVizNotes] = useState("");
  const [vizSaved, setVizSaved] = useState(false);
  const [showThermo, setShowThermo] = useState(
    !initialThermostatMin || !initialThermostatMax,
  );
  const [busy, setBusy] = useState(false);

  async function saveThermostat() {
    setBusy(true);
    const res = await fetch(`/api/jugadores/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scoreThermostatMin: thermoMin ? parseInt(thermoMin) : null,
        scoreThermostatMax: thermoMax ? parseInt(thermoMax) : null,
        scoreDesired: desired ? parseInt(desired) : null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setShowThermo(false);
      router.refresh();
    } else {
      alert("Error guardando");
    }
  }

  async function saveVisualization() {
    setBusy(true);
    const res = await fetch("/api/visualizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        roundId,
        score: vizScore ? parseInt(vizScore) : null,
        notes: vizNotes.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setVizSaved(true);
    } else {
      alert("Error guardando visualización");
    }
  }

  function startRound() {
    router.push(`/rondas/${roundId}`);
  }

  return (
    <>
      {/* Configurar Thermostat (collapsable) */}
      {showThermo ? (
        <>
          <SectionHeader>⚙️ Configurar termostato</SectionHeader>
          <Card className="!p-3 space-y-3">
            <p className="text-[11px] text-[var(--muted)]">
              Tu rango habitual de score (las últimas rondas) y el score que
              querés alcanzar hoy. El score deseado debería estar BAJO el rango
              habitual para empujarte un poco.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase text-[var(--muted)]">
                  Min habitual
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="gf-input mt-0.5 text-center"
                  placeholder="78"
                  value={thermoMin}
                  onChange={(e) => setThermoMin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-[var(--muted)]">
                  Max habitual
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="gf-input mt-0.5 text-center"
                  placeholder="88"
                  value={thermoMax}
                  onChange={(e) => setThermoMax(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-[var(--muted)]">
                  Deseado hoy
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="gf-input mt-0.5 text-center"
                  placeholder="76"
                  value={desired}
                  onChange={(e) => setDesired(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={saveThermostat}
              disabled={busy}
              className="gf-btn w-full !text-sm"
            >
              {busy ? "Guardando..." : "Guardar termostato"}
            </button>
          </Card>
        </>
      ) : (
        <button
          onClick={() => setShowThermo(true)}
          className="text-xs text-[var(--fairway)] underline"
        >
          ⚙️ Editar termostato / score deseado
        </button>
      )}

      {/* Visualización pre-ronda */}
      <SectionHeader>🧘 Visualización (30 segundos)</SectionHeader>
      <Card className="!p-3 space-y-2" style={{ borderLeft: "4px solid var(--accent)" }}>
        <p className="text-[11px] text-[var(--muted)]">
          Cerrá los ojos. Imaginate jugando una ronda perfecta hoy: cada hoyo
          ejecutado bien, las decisiones acertadas, el score que querés. Cuando
          termines, anotá qué viste.
        </p>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Score visualizado
          </label>
          <input
            type="number"
            inputMode="numeric"
            className="gf-input mt-0.5 text-center"
            placeholder="ej 76"
            value={vizScore}
            onChange={(e) => setVizScore(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Qué viste / sentiste (opcional)
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={2}
            placeholder="Pegándole sólido al driver, putts cayendo, decisiones tranquilas..."
            value={vizNotes}
            onChange={(e) => setVizNotes(e.target.value)}
          />
        </div>
        <button
          onClick={saveVisualization}
          disabled={busy || vizSaved}
          className={vizSaved ? "gf-btn gf-btn-secondary w-full !text-sm" : "gf-btn w-full !text-sm"}
        >
          {vizSaved ? "✓ Visualización guardada" : busy ? "Guardando..." : "Visualicé mi ronda"}
        </button>
      </Card>

      {/* Empezar */}
      <button
        onClick={startRound}
        className="gf-btn w-full !py-3 mt-2"
        style={{ background: "var(--fairway)" }}
      >
        ⛳ Empezar a jugar →
      </button>
    </>
  );
}
