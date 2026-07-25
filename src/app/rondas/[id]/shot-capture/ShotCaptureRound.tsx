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
        <div className="text-xs text-[var(--muted)] text-center">
          {shots.length} tiro(s) cargado(s) en el hoyo {hole.number}
        </div>
      )}
    </div>
  );
}
