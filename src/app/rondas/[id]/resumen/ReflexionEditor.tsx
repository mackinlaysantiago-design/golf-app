"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

const EMOTION_OPTIONS = [
  "CONFIANZA",
  "TRANQUILIDAD",
  "DETERMINACIÓN",
  "FRUSTRACIÓN",
  "NERVIOS",
  "ANSIEDAD",
  "ENOJO",
  "DISTRAÍDO",
];

export default function ReflexionEditor({
  roundId,
  playerId,
  initialBestParts,
  initialBestShot,
  initialCommitment,
  initialEmotion,
}: {
  roundId: string;
  playerId: string | null;
  initialBestParts: string[];
  initialBestShot: string;
  initialCommitment: number | null;
  initialEmotion: string | null;
}) {
  const router = useRouter();
  const [parts, setParts] = useState<string[]>([
    initialBestParts[0] ?? "",
    initialBestParts[1] ?? "",
    initialBestParts[2] ?? "",
  ]);
  const [bestShot, setBestShot] = useState(initialBestShot);
  const [commitment, setCommitment] = useState(initialCommitment ?? 7);
  const [emotion, setEmotion] = useState<string>(initialEmotion ?? "");
  const [storyNote, setStoryNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function setPart(i: number, v: string) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    const payload = {
      bestParts: JSON.stringify(parts.filter((p) => p.trim() !== "")),
      bestShot: bestShot.trim() || null,
      commitmentScore: commitment,
      emotionPlayed: emotion || null,
    };
    const res = await fetch(`/api/rondas/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reflexion: payload }),
    });
    if (!res.ok) {
      setBusy(false);
      alert("Error guardando");
      return;
    }

    // Guardar story / self-talk como MentalNote (si hay contenido + playerId)
    if (playerId && storyNote.trim()) {
      await fetch("/api/mental-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          type: "STORY",
          context: "ROUND",
          contextId: roundId,
          content: storyNote.trim(),
        }),
      });
      setStoryNote("");
    }

    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="!p-3 space-y-3">
      {/* Compromiso (slider) */}
      <div>
        <div className="flex justify-between items-baseline">
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Compromiso promedio del día
          </label>
          <span className="gf-display text-2xl text-[var(--fairway)]">
            {commitment}
            <span className="text-xs text-[var(--muted)]">/10</span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={commitment}
          onChange={(e) => setCommitment(parseInt(e.target.value))}
          className="w-full mt-1"
        />
        <div className="text-[10px] text-[var(--muted)] mt-0.5">
          ¿Qué tan comprometido estuviste con cada tiro? 10 = todos full focus,
          1 = jugaste en automático.
        </div>
      </div>

      {/* Emoción dominante */}
      <div className="border-t border-[var(--green-pale)] pt-3">
        <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Emoción dominante de la ronda
        </label>
        <div className="flex flex-wrap gap-1 mt-2">
          {EMOTION_OPTIONS.map((e) => {
            const active = emotion === e;
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEmotion(active ? "" : e)}
                className="text-[10px] px-2 py-1 rounded gf-mono"
                style={{
                  background: active ? "var(--accent)" : "var(--green-pale)",
                  color: active ? "white" : "var(--fairway)",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      {/* Story / self-talk */}
      <div className="border-t border-[var(--green-pale)] pt-3">
        <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
          La historia que te contaste (opcional)
        </label>
        <textarea
          className="gf-input mt-1"
          rows={2}
          placeholder='ej: "Otra vez me caí en los últimos 3 hoyos" / "Mantuve la calma cuando se complicó"'
          value={storyNote}
          onChange={(e) => setStoryNote(e.target.value)}
        />
        <div className="text-[10px] text-[var(--muted)] mt-0.5">
          Se guarda en tu diario mental. Patrones repetidos = creencias a trabajar.
        </div>
      </div>

      {/* Best parts (existente) */}
      <div className="border-t border-[var(--green-pale)] pt-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Lo que jugaste mejor hoy
        </div>
        {parts.map((p, i) => (
          <input
            key={i}
            className="gf-input mt-1"
            placeholder={`Mejor ${i + 1}`}
            value={p}
            onChange={(e) => setPart(i, e.target.value)}
          />
        ))}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Tu mejor tiro del día (descripción)
        </div>
        <textarea
          className="gf-input mt-1"
          rows={2}
          placeholder="Describí ese tiro que te quedó perfecto..."
          value={bestShot}
          onChange={(e) => setBestShot(e.target.value)}
        />
      </div>

      <button onClick={save} disabled={busy} className="gf-btn w-full !text-sm">
        {busy ? "Guardando..." : saved ? "✓ Guardado" : "Guardar reflexión"}
      </button>
    </Card>
  );
}
