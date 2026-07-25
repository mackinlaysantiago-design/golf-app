"use client";

// Wrapper de ronda para el shot-capture: maneja hoyo actual + nº de tiro por hoyo,
// y monta <ShotCapture> con los datos del hoyo. Cada tiro guardado resetea el capturador
// (via key) para dictar el siguiente.

import { useState } from "react";
import ShotCapture from "./ShotCapture";
import type { ClubCarry, HoleGreen } from "@/lib/shot-gps";
import type { ParsedShot } from "@/lib/gemini-shot";

export type HoleForCapture = {
  number: number;
  par: number;
  roundHoleId: string;
  green: HoleGreen;
};

export default function ShotCaptureRound({
  holes,
  carries,
}: {
  holes: HoleForCapture[];
  carries: ClubCarry[];
}) {
  const [idx, setIdx] = useState(0);
  const [shotsByHole, setShotsByHole] = useState<Record<number, ParsedShot[]>>({});

  if (holes.length === 0) {
    return <p className="text-sm text-[var(--muted)] p-4">Esta ronda no tiene hoyos cargados.</p>;
  }

  const hole = holes[idx];
  const shots = shotsByHole[hole.number] ?? [];

  function onSaved(p: ParsedShot) {
    setShotsByHole((prev) => ({
      ...prev,
      [hole.number]: [...(prev[hole.number] ?? []), p],
    }));
  }

  return (
    <div className="px-4 pt-5 pb-4 space-y-3" style={{ maxWidth: 460, margin: "0 auto" }}>
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="text-sm px-3 py-1 disabled:opacity-30"
        >
          ‹ Hoyo
        </button>
        <span className="gf-display text-xl text-[var(--fairway)]">
          Hoyo {hole.number} · Par {hole.par}
        </span>
        <button
          onClick={() => setIdx((i) => Math.min(holes.length - 1, i + 1))}
          disabled={idx === holes.length - 1}
          className="text-sm px-3 py-1 disabled:opacity-30"
        >
          Hoyo ›
        </button>
      </div>

      <ShotCapture
        key={`${hole.number}-${shots.length}`}
        roundHoleId={hole.roundHoleId}
        holeNumber={hole.number}
        par={hole.par}
        green={hole.green}
        carries={carries}
        shotNumber={shots.length + 1}
        onSaved={onSaved}
      />

      {shots.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {shots.length} tiro(s) — hoyo {hole.number}
          </div>
          {shots.map((s, i) => (
            <div
              key={i}
              className="rounded-xl bg-white p-2.5"
              style={{ boxShadow: "0 1px 3px rgba(20,35,26,.06)" }}
            >
              <div className="font-bold text-sm mb-1">
                Tiro {i + 1}
                {s.club && (
                  <span className="text-[var(--muted)] font-semibold text-xs ml-1">{s.club}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.decisionQuality && (
                  <SChip k="Decisión" v={s.decisionQuality === "GOOD" ? "✓ Bien" : "✗ Mala"} bg="#eaf1fe" fg="#2563eb" />
                )}
                {s.executionQuality && <SChip k="Ejecución" v={s.executionQuality} bg="#fdf3e6" fg="#d97706" />}
                {s.result && <SChip k="Resultado" v={s.result} bg="#e8f5ec" fg="#15803d" />}
              </div>
              {s.transcript && (
                <div className="text-[11px] text-[var(--muted)] italic mt-1.5">🎙️ {s.transcript}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SChip({ k, v, bg, fg }: { k: string; v: string; bg: string; fg: string }) {
  return (
    <span
      className="text-xs font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1"
      style={{ background: bg, color: fg }}
    >
      <span className="text-[9px] uppercase opacity-70">{k}</span>
      {v}
    </span>
  );
}
