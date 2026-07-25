"use client";

// Wrapper de ronda para el shot-capture: maneja hoyo actual + nº de tiro por hoyo,
// y monta <ShotCapture> con los datos del hoyo. Cada tiro guardado resetea el capturador
// (via key) para dictar el siguiente.

import { useRef, useState } from "react";
import ShotCapture from "./ShotCapture";
import ShotsMapPanel from "./ShotsMapPanel";
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

      <BatchRecorder
        roundHoleId={hole.roundHoleId}
        holeNumber={hole.number}
        par={hole.par}
        baseShotNumber={shots.length + 1}
        onSavedMany={(ps) =>
          setShotsByHole((prev) => ({
            ...prev,
            [hole.number]: [...(prev[hole.number] ?? []), ...ps],
          }))
        }
      />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 px-1">
          🗺️ Tiros en el mapa — arrastrá para corregir, tap para ubicar
        </div>
        <ShotsMapPanel
          key={hole.roundHoleId}
          roundHoleId={hole.roundHoleId}
          hole={{
            teeLat: null,
            teeLng: null,
            centerLat: hole.green.centerLat,
            centerLng: hole.green.centerLng,
          }}
        />
      </div>

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

function BatchRecorder({
  roundHoleId,
  holeNumber,
  par,
  baseShotNumber,
  onSavedMany,
}: {
  roundHoleId: string;
  holeNumber: number;
  par: number;
  baseShotNumber: number;
  onSavedMany: (ps: ParsedShot[]) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "rec" | "sending" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        void send(b);
      };
      mr.current = rec;
      rec.start();
      setPhase("rec");
    } catch {
      setErr("No pude acceder al micrófono");
      setPhase("error");
    }
  }
  function stop() {
    mr.current?.stop();
    setPhase("sending");
  }
  async function send(b: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", b, "shots.webm");
      fd.append("batch", "1");
      fd.append("roundHoleId", roundHoleId);
      fd.append("holeNumber", String(holeNumber));
      fd.append("par", String(par));
      fd.append("shotNumber", String(baseShotNumber));
      const res = await fetch("/api/shots/voice", { method: "POST", body: fd });
      const j = (await res.json()) as { parsedList?: ParsedShot[]; error?: string };
      if (!res.ok || !j.parsedList) throw new Error(j.error || "error del servidor");
      onSavedMany(j.parsedList);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
      setPhase("error");
    }
  }

  return (
    <div className="rounded-xl p-2 text-center" style={{ background: "var(--green-pale)" }}>
      <button
        onClick={phase === "rec" ? stop : start}
        disabled={phase === "sending"}
        className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
        style={{ background: phase === "rec" ? "var(--red)" : "var(--fairway)", color: "white" }}
      >
        {phase === "sending"
          ? "🧠 Separando tiros…"
          : phase === "rec"
          ? "⏹ Terminar (dictá todos los tiros)"
          : "🎙️ Dictar varios tiros de una"}
      </button>
      {err && <div className="text-xs text-[var(--red)] mt-1">{err}</div>}
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
