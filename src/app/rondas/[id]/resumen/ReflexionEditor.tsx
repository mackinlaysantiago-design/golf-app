"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

export default function ReflexionEditor({
  roundId,
  initialBestParts,
  initialBestShot,
}: {
  roundId: string;
  initialBestParts: string[];
  initialBestShot: string;
}) {
  const router = useRouter();
  const [parts, setParts] = useState<string[]>([
    initialBestParts[0] ?? "",
    initialBestParts[1] ?? "",
    initialBestParts[2] ?? "",
  ]);
  const [bestShot, setBestShot] = useState(initialBestShot);
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
    };
    const res = await fetch(`/api/rondas/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reflexion: payload }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Error guardando");
    }
  }

  return (
    <Card className="!p-3 space-y-2">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        Lo que jugaste mejor hoy
      </div>
      {parts.map((p, i) => (
        <input
          key={i}
          className="gf-input"
          placeholder={`Mejor ${i + 1}`}
          value={p}
          onChange={(e) => setPart(i, e.target.value)}
        />
      ))}
      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mt-2">
        Tu mejor tiro del día (descripción)
      </div>
      <textarea
        className="gf-input"
        rows={3}
        placeholder="Describí ese tiro que te quedó perfecto..."
        value={bestShot}
        onChange={(e) => setBestShot(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="gf-btn flex-1 !text-sm">
          {busy ? "Guardando..." : saved ? "✓ Guardado" : "Guardar reflexión"}
        </button>
      </div>
    </Card>
  );
}
