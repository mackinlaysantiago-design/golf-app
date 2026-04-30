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
  carryYds: number | null;
  totalYds: number | null;
  smashFactor: number | null;
  ballSpeedMph: number | null;
  spinRpm: number | null;
  shotType: string | null;
};

export default function NuevaRangePage() {
  const router = useRouter();
  const [club, setClub] = useState("DRIVER");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [shots, setShots] = useState<ParsedShot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(f: File) {
    setFile(f);
    setShots(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function parseImage() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/analyze-flightscope", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setShots(data.shots);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error parseando imagen");
    }
    setBusy(false);
  }

  async function save() {
    if (!shots || shots.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/range-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(date).toISOString(),
        club,
        notes: notes || null,
        shots,
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
        <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva range</h1>
      </header>

      <Card className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Palo
          </label>
          <select
            className="gf-input mt-1"
            value={club}
            onChange={(e) => setClub(e.target.value)}
          >
            {CLUBS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
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

      <SectionHeader>Screenshot FlightScope</SectionHeader>
      <Card className="space-y-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="gf-input"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="preview"
            className="rounded-xl border border-[var(--border)] max-h-64 object-contain w-full bg-[var(--ink)]"
          />
        )}
        {file && !shots && (
          <button onClick={parseImage} disabled={busy} className="gf-btn w-full">
            {busy ? "Parseando con Claude..." : "🤖 Extraer shots"}
          </button>
        )}
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      </Card>

      {shots && (
        <>
          <SectionHeader>Preview de {shots.length} shots</SectionHeader>
          <Card className="!p-2 overflow-x-auto">
            <table className="gf-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Carry</th>
                  <th>Total</th>
                  <th>Ball</th>
                  <th>Smash</th>
                  <th>Spin</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((s, i) => (
                  <tr key={i} className={s.rowType !== "SHOT" ? "font-semibold bg-[var(--green-pale)]" : ""}>
                    <td className="gf-mono">
                      {s.rowType === "SHOT" ? s.shotNumber : s.rowType}
                    </td>
                    <td className="gf-mono">{s.carryYds?.toFixed(1) ?? "—"}</td>
                    <td className="gf-mono">{s.totalYds?.toFixed(1) ?? "—"}</td>
                    <td className="gf-mono">{s.ballSpeedMph?.toFixed(1) ?? "—"}</td>
                    <td className="gf-mono">{s.smashFactor?.toFixed(2) ?? "—"}</td>
                    <td className="gf-mono">{s.spinRpm ?? "—"}</td>
                    <td className="text-xs">{s.shotType ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <button onClick={save} disabled={busy} className="gf-btn w-full">
            {busy ? "Guardando..." : "💾 Guardar sesión"}
          </button>
        </>
      )}
    </div>
  );
}
