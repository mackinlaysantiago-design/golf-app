"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  WEDGES,
  SWING_POSITIONS,
  cellKey,
  computeCell,
  suggestOutliers,
  dispersionTone,
} from "@/lib/wedge-matrix";

type Cell = {
  wedgeType: string;
  swingType: string;
  avgYards: number;
  dispersionYards: number | null;
  goalDispersionYards: number;
  isLockedIn: boolean;
  chunksOrBladesRejected: number;
  shots: number[];
  date: string;
};

type MatrixData = {
  player: { id: string; name: string };
  matrix: Record<string, Cell>;
  sessions: { id: string; date: string; notes: string | null; entries: number }[];
};

const toneColor = (t: string) =>
  t === "good" ? "var(--green)" : t === "warn" ? "var(--accent)" : t === "bad" ? "var(--red)" : "var(--muted)";

export default function WedgeMatrixClient() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [open, setOpen] = useState<{ wedge: string; swing: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/wedge-matrix", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matrix = data?.matrix ?? {};

  // detección de números repetidos (mismo yardaje, distinta trayectoria)
  const repeated = useMemo(() => {
    const cells = Object.values(matrix);
    const dup = new Set<string>();
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++)
        if (Math.abs(cells[i].avgYards - cells[j].avgYards) <= 3) {
          dup.add(cellKey(cells[i].wedgeType, cells[i].swingType));
          dup.add(cellKey(cells[j].wedgeType, cells[j].swingType));
        }
    return dup;
  }, [matrix]);

  const known = Object.keys(matrix).length;
  const locked = Object.values(matrix).filter((c) => c.isLockedIn).length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <MiniKPI label="Números" value={`${known}/16`} hint={known >= 12 ? "wedge master 🎯" : "meta 12+"} />
        <MiniKPI label="Locked in" value={locked} tone={locked > 0 ? "good" : "neutral"} />
        <MiniKPI label="Goal gap" value="4" unit="yds" />
      </div>

      <SectionHeader>Matriz · tocá una celda para cargar</SectionHeader>

      {/* Grid: filas = wedges, columnas = posiciones */}
      <Card className="!p-2 overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 320 }}>
          <thead>
            <tr>
              <th className="w-9"></th>
              {SWING_POSITIONS.map((p) => (
                <th key={p.key} className="text-center pb-1">
                  <div className="gf-display text-base text-[var(--fairway)] leading-none">{p.label}</div>
                  <div className="text-[9px] text-[var(--muted)] gf-mono">{p.pct}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEDGES.map((w) => (
              <tr key={w.key}>
                <td className="gf-display text-lg text-[var(--fairway)] text-center pr-1">{w.label}</td>
                {SWING_POSITIONS.map((p) => {
                  const c = matrix[cellKey(w.key, p.key)];
                  const isRep = repeated.has(cellKey(w.key, p.key));
                  const tone = dispersionTone(c?.dispersionYards ?? null, c?.goalDispersionYards ?? 4);
                  return (
                    <td key={p.key} className="p-0.5">
                      <button
                        onClick={() => setOpen({ wedge: w.key, swing: p.key })}
                        className="w-full rounded-xl border text-center py-2 px-1 transition active:scale-95"
                        style={{
                          borderColor: c ? toneColor(tone) : "var(--border)",
                          background: c ? "var(--sand)" : "transparent",
                          minHeight: 56,
                        }}
                      >
                        {c ? (
                          <>
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="gf-display text-2xl text-[var(--ink)] leading-none">
                                {Math.round(c.avgYards)}
                              </span>
                              {c.isLockedIn && <span className="text-[10px]">🔒</span>}
                            </div>
                            <div className="text-[9px] gf-mono" style={{ color: toneColor(tone) }}>
                              ±{c.dispersionYards ?? "?"}
                              {isRep && <span className="text-[var(--accent)]"> ≈</span>}
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)] text-lg">+</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px] text-[var(--muted)] px-1">
        🔒 = locked in (8+ tiros, gap ≤ goal) · <span className="text-[var(--accent)]">≈</span> número repetido
        (mismo yardaje, distinta trayectoria) · color del borde = tamaño del gap.
      </p>

      {open && (
        <CellModal
          wedge={open.wedge}
          swing={open.swing}
          existing={matrix[cellKey(open.wedge, open.swing)] ?? null}
          onClose={() => setOpen(null)}
          onSaved={async () => {
            await load();
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function MiniKPI({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "good" | "neutral";
}) {
  return (
    <div className="gf-card flex flex-col gap-0.5 !p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="gf-display text-3xl" style={{ color: tone === "good" ? "var(--green)" : "var(--ink)" }}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-[var(--muted)] gf-mono">{unit}</span>}
      </div>
      {hint && <div className="text-[10px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

const wedgeLabel = (k: string) => WEDGES.find((w) => w.key === k)?.label ?? k;
const swingLabel = (k: string) => SWING_POSITIONS.find((s) => s.key === k)?.label ?? k;

function CellModal({
  wedge,
  swing,
  existing,
  onClose,
  onSaved,
}: {
  wedge: string;
  swing: string;
  existing: Cell | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">(
    existing ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [carries, setCarries] = useState<number[]>(existing?.shots ?? []);
  const [included, setIncluded] = useState<boolean[]>(
    existing ? existing.shots.map(() => true) : [],
  );
  const [goal, setGoal] = useState(existing?.goalDispersionYards ?? 4);
  const [saving, setSaving] = useState(false);

  const kept = carries.filter((_, i) => included[i]);
  const stats = computeCell(kept, goal);

  function onFile(f: File) {
    setFile(f);
    setStatus("idle");
    setError(null);
    const r = new FileReader();
    r.onload = (e) => setPreview(e.target?.result as string);
    r.readAsDataURL(f);
  }

  async function parse() {
    if (!file) return;
    setStatus("parsing");
    setError(null);
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/analyze-flightscope", { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setStatus("error");
      setError(d.error ?? "Error parseando imagen");
      return;
    }
    const d = await res.json();
    const cs: number[] = (d.shots ?? [])
      .filter((s: { rowType: string; carryYds: number | null }) => s.rowType === "SHOT" && s.carryYds != null)
      .map((s: { carryYds: number }) => Math.round(s.carryYds * 10) / 10);
    if (cs.length === 0) {
      setStatus("error");
      setError("No se detectaron carries en la imagen");
      return;
    }
    const flagged = suggestOutliers(cs);
    setCarries(cs);
    setIncluded(cs.map((_, i) => !flagged[i]));
    setStatus("ready");
  }

  async function save() {
    if (kept.length === 0) return;
    setSaving(true);
    const res = await fetch("/api/wedge-matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wedgeType: wedge,
        swingType: swing,
        carries: kept,
        chunksRejected: carries.length - kept.length,
        goalDispersionYards: goal,
      }),
    });
    if (res.ok) onSaved();
    else {
      setError("Error guardando celda");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--white)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gf-section-header flex items-center justify-between sticky top-0">
          <span>
            {wedgeLabel(wedge)} · {swingLabel(swing)}
          </span>
          <button onClick={onClose} className="text-white/80 text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <label className="gf-btn gf-btn-secondary w-full cursor-pointer flex items-center justify-center !text-sm">
            {file ? "Cambiar screenshot" : "📷 Subir screenshot FlightScope"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="preview"
              className="rounded-xl border border-[var(--border)] max-h-40 object-contain w-full bg-[var(--ink)]"
            />
          )}

          {file && status !== "ready" && (
            <button onClick={parse} disabled={status === "parsing"} className="gf-btn w-full !text-sm">
              {status === "parsing" ? "Parseando..." : "🤖 Extraer carries"}
            </button>
          )}

          {error && <p className="text-xs text-[var(--red)]">{error}</p>}

          {carries.length > 0 && (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Carries · tocá para excluir chunks/skulls
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {carries.map((c, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setIncluded((prev) => prev.map((v, j) => (j === i ? !v : v)))
                      }
                      className="gf-mono text-sm rounded-full px-2.5 py-1 border transition"
                      style={
                        included[i]
                          ? { borderColor: "var(--green)", background: "var(--green-pale)", color: "var(--ink)" }
                          : { borderColor: "var(--border)", color: "var(--muted)", textDecoration: "line-through" }
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* stats en vivo */}
              <div className="grid grid-cols-3 gap-2">
                <LiveStat label="Avg" value={stats.avg ?? "—"} unit="yds" />
                <LiveStat
                  label="Gap"
                  value={stats.dispersion ?? "—"}
                  unit="yds"
                  color={toneColor(dispersionTone(stats.dispersion, goal))}
                />
                <LiveStat label="Tiros" value={stats.n} hint={stats.lockedIn ? "🔒 locked" : ""} />
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>Goal gap:</span>
                {[3, 4, 5, 6].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className="rounded-full px-2 py-0.5 border"
                    style={
                      goal === g
                        ? { borderColor: "var(--fairway)", background: "var(--fairway)", color: "white" }
                        : { borderColor: "var(--border)" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>

              <button onClick={save} disabled={saving || kept.length === 0} className="gf-btn w-full">
                {saving ? "Guardando..." : `💾 Guardar celda (${kept.length} tiros, avg ${stats.avg ?? "—"})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveStat({
  label,
  value,
  unit,
  hint,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="gf-card !p-2 flex flex-col gap-0.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="gf-display text-2xl" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </div>
      {unit && <div className="text-[9px] text-[var(--muted)] gf-mono -mt-1">{unit}</div>}
      {hint && <div className="text-[10px] text-[var(--green)]">{hint}</div>}
    </div>
  );
}
