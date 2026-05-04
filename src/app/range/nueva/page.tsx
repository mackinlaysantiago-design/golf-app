"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";

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

type ParsedShot = {
  shotNumber: number;
  rowType: string;
  club?: string | null;
  carryYds: number | null;
  totalYds: number | null;
  smashFactor: number | null;
  ballSpeedMph: number | null;
  spinRpm: number | null;
  shotType: string | null;
};

type Block = {
  id: string;
  club: string;
  file: File | null;
  preview: string | null;
  shots: ParsedShot[] | null;
  status: "idle" | "parsing" | "ready" | "error";
  error: string | null;
};

function newBlock(defaultClub: string = "DRIVER"): Block {
  return {
    id: crypto.randomUUID(),
    club: defaultClub,
    file: null,
    preview: null,
    shots: null,
    status: "idle",
    error: null,
  };
}

export default function NuevaRangePage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([newBlock()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== id) : prev));
  }

  function onFile(id: string, f: File) {
    updateBlock(id, { file: f, shots: null, status: "idle", error: null });
    const reader = new FileReader();
    reader.onload = (e) => updateBlock(id, { preview: e.target?.result as string });
    reader.readAsDataURL(f);
  }

  async function parseBlock(id: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block || !block.file) return;
    updateBlock(id, { status: "parsing", error: null });
    const fd = new FormData();
    fd.append("image", block.file);
    const res = await fetch("/api/analyze-flightscope", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      updateBlock(id, { status: "error", error: data.error ?? "Error parseando imagen" });
      return;
    }
    const data = await res.json();
    updateBlock(id, { shots: data.shots, status: "ready" });
  }

  const allReady =
    blocks.length > 0 &&
    blocks.every((b) => b.status === "ready" && b.shots && b.shots.length > 0);
  const totalShots = blocks.reduce(
    (s, b) => s + (b.shots?.filter((sh) => sh.rowType === "SHOT").length ?? 0),
    0,
  );

  async function save() {
    if (!allReady) return;
    setBusy(true);
    setError(null);

    // Construir array de shots taggeados por club, renumerar SHOTs
    // consecutivamente y deduplicar AVG/DEV (uno solo final)
    const allShots: ParsedShot[] = [];
    let nextNum = 1;
    let haveAvg = false;
    let haveDev = false;
    for (const b of blocks) {
      for (const s of b.shots ?? []) {
        if (s.rowType === "AVG") {
          if (haveAvg) continue;
          haveAvg = true;
          allShots.push({ ...s, club: b.club });
        } else if (s.rowType === "DEV") {
          if (haveDev) continue;
          haveDev = true;
          allShots.push({ ...s, club: b.club });
        } else {
          allShots.push({ ...s, club: b.club, shotNumber: nextNum++ });
        }
      }
    }

    // El club "primario" de la sesión: el del primer bloque (legacy)
    const primaryClub = blocks[0]?.club ?? "DRIVER";

    const res = await fetch("/api/range-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(date).toISOString(),
        club: primaryClub,
        notes: notes || null,
        shots: allShots,
      }),
    });
    if (res.ok) {
      const session = await res.json();
      router.push(`/range/${session.id}`);
      router.refresh();
    } else {
      setError("Error guardando sesión");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva sesión Range</h1>
      </header>

      {/* Encabezado: fecha + notas */}
      <Card className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
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
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Notas (opcional)
          </label>
          <textarea
            className="gf-input mt-1"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Card>

      <SectionHeader>Palos · Screenshots FlightScope</SectionHeader>

      {blocks.map((b, idx) => (
        <Card
          key={b.id}
          className="space-y-3"
          style={
            b.status === "ready"
              ? { borderLeft: "4px solid var(--green)" }
              : b.status === "error"
              ? { borderLeft: "4px solid var(--red)" }
              : undefined
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Palo #{idx + 1}
            </span>
            {blocks.length > 1 && (
              <button
                onClick={() => removeBlock(b.id)}
                className="text-[var(--red)] text-xs"
              >
                ✕ Quitar
              </button>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select
              className="gf-input"
              value={b.club}
              onChange={(e) => updateBlock(b.id, { club: e.target.value })}
            >
              {CLUBS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <label className="gf-btn gf-btn-secondary !text-xs cursor-pointer flex items-center px-3">
              {b.file ? "Cambiar foto" : "Choose file"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(b.id, e.target.files[0])}
              />
            </label>
          </div>
          {b.file && (
            <div className="text-[10px] gf-mono text-[var(--muted)] truncate">
              {b.file.name}
            </div>
          )}

          {b.preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.preview}
              alt="preview"
              className="rounded-xl border border-[var(--border)] max-h-48 object-contain w-full bg-[var(--ink)]"
            />
          )}

          {b.file && b.status !== "ready" && (
            <button
              onClick={() => parseBlock(b.id)}
              disabled={b.status === "parsing"}
              className="gf-btn w-full !text-sm"
            >
              {b.status === "parsing" ? "Parseando..." : "🤖 Extraer shots"}
            </button>
          )}

          {b.status === "ready" && b.shots && (
            <div className="text-[11px] gf-mono text-[var(--green)]">
              ✓ {b.shots.filter((s) => s.rowType === "SHOT").length} shots extraídos
            </div>
          )}

          {b.error && <p className="text-xs text-[var(--red)]">{b.error}</p>}
        </Card>
      ))}

      <button
        onClick={() => setBlocks((prev) => [...prev, newBlock()])}
        className="gf-card !p-3 text-center text-[var(--fairway)] font-semibold border-dashed w-full"
      >
        + Agregar otro palo
      </button>

      {error && <p className="text-xs text-[var(--red)] text-center">{error}</p>}

      <button
        onClick={save}
        disabled={busy || !allReady}
        className="gf-btn w-full"
      >
        {busy
          ? "Guardando..."
          : allReady
          ? `💾 Guardar sesión (${totalShots} shots)`
          : "Extraé los shots de cada palo primero"}
      </button>
    </div>
  );
}
