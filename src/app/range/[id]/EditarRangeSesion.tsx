"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

const CLUBS = [
  { value: "DRIVER", label: "Driver" },
  { value: "WOOD_3", label: "Madera 3" },
  { value: "WOOD_5", label: "Madera 5" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "IRON_3", label: "Hierro 3" },
  { value: "IRON_4", label: "Hierro 4" },
  { value: "IRON_5", label: "Hierro 5" },
  { value: "IRON_6", label: "Hierro 6" },
  { value: "IRON_7", label: "Hierro 7" },
  { value: "IRON_8", label: "Hierro 8" },
  { value: "IRON_9", label: "Hierro 9" },
  { value: "PW", label: "PW" },
  { value: "GW", label: "GW" },
  { value: "SW", label: "SW" },
  { value: "LW", label: "LW" },
];

export default function EditarRangeSesion({
  sessionId,
  initialClub,
  initialDate,
  initialNotes,
}: {
  sessionId: string;
  initialClub: string;
  initialDate: string; // ISO
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [club, setClub] = useState(initialClub);
  const [date, setDate] = useState(initialDate.slice(0, 10));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);

  // Multi-foto upload state
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  async function saveSetup() {
    setBusy(true);
    const res = await fetch(`/api/range-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        club,
        date: new Date(date).toISOString(),
        notes: notes.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      setOpen(false);
    } else {
      alert("Error guardando");
    }
  }

  async function uploadAndAppend() {
    if (files.length === 0) return;
    setBusy(true);
    let totalAdded = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Parseando foto ${i + 1}/${files.length}...`);
      const fd = new FormData();
      fd.append("image", files[i]);
      const parseRes = await fetch("/api/analyze-flightscope", {
        method: "POST",
        body: fd,
      });
      if (!parseRes.ok) {
        alert(`Error parseando foto ${i + 1}`);
        continue;
      }
      const { shots } = await parseRes.json();
      const appendRes = await fetch(`/api/range-sessions/${sessionId}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shots }),
      });
      if (appendRes.ok) {
        const data = await appendRes.json();
        totalAdded += data.added ?? 0;
      }
    }
    setProgress(null);
    setBusy(false);
    setFiles([]);
    alert(`Agregados ${totalAdded} shots`);
    router.refresh();
  }

  async function deleteSession() {
    if (!confirm("¿Borrar esta sesión completa? Esto borra todos los shots.")) return;
    setBusy(true);
    const res = await fetch(`/api/range-sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/range");
      router.refresh();
    } else {
      alert("Error borrando");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--fairway)] underline"
      >
        ⚙️ Editar setup / agregar fotos
      </button>
    );
  }

  return (
    <Card className="space-y-3" style={{ borderLeft: "4px solid var(--accent)" }}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Editar sesión</h3>
        <button onClick={() => setOpen(false)} className="text-2xl px-2">✕</button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Palo
        </label>
        <select
          className="gf-input mt-1"
          value={club}
          onChange={(e) => setClub(e.target.value)}
        >
          {CLUBS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Fecha
        </label>
        <input
          type="date"
          className="gf-input mt-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Notas
        </label>
        <textarea
          className="gf-input mt-1"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button onClick={saveSetup} disabled={busy} className="gf-btn w-full">
        {busy ? "Guardando..." : "Guardar setup"}
      </button>

      <div className="border-t pt-3">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
          Agregar más fotos
        </div>
        <p className="text-[11px] text-[var(--muted)] mb-2">
          Subí varias fotos de FlightScope a la vez. Cada una se parsea y los shots
          se suman a la sesión. El análisis IA se invalida (re-correrlo después).
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="gf-input"
        />
        {files.length > 0 && (
          <div className="text-[11px] text-[var(--muted)] gf-mono mt-1">
            {files.length} foto{files.length === 1 ? "" : "s"} seleccionada
            {files.length === 1 ? "" : "s"}
          </div>
        )}
        {progress && (
          <div className="text-[11px] text-[var(--accent)] mt-1">{progress}</div>
        )}
        <button
          onClick={uploadAndAppend}
          disabled={busy || files.length === 0}
          className="gf-btn w-full mt-2"
        >
          {busy ? "Procesando..." : "📤 Subir y parsear"}
        </button>
      </div>

      <div className="border-t pt-3">
        <button
          onClick={deleteSession}
          disabled={busy}
          className="gf-btn gf-btn-secondary w-full !text-xs"
          style={{ color: "var(--red)" }}
        >
          Borrar sesión completa
        </button>
      </div>
    </Card>
  );
}
