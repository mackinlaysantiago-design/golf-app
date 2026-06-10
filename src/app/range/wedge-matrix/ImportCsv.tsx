"use client";

import { useState } from "react";
import {
  WEDGES,
  SWING_POSITIONS,
  parseClubName,
  normalizeClub,
  computeCell,
  suggestOutliers,
  dispersionTone,
  cellKey,
} from "@/lib/wedge-matrix";
import { parseFlightscopeCsv, type CsvShot } from "@/lib/flightscope-csv";
import CLUB_LABEL from "@/lib/club-labels";

type Group = {
  rawClub: string;
  shots: CsvShot[];
  carries: number[]; // carrys de las SHOT con valor
  target: string; // "RANGE" | "SKIP" | "LW__FULL" ...
  included: boolean[]; // por carry (para celdas)
};

const CELL_OPTIONS = WEDGES.flatMap((w) =>
  SWING_POSITIONS.map((p) => ({ value: cellKey(w.key, p.key), label: `${w.label} · ${p.label}` })),
);

const toneColor = (t: string) =>
  t === "good" ? "var(--green)" : t === "warn" ? "var(--accent)" : t === "bad" ? "var(--red)" : "var(--muted)";

export default function ImportCsv({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onFile(f: File) {
    setError(null);
    setFileName(f.name);
    const text = await f.text();
    const parsed = parseFlightscopeCsv(text);
    if (parsed.length === 0) {
      setError("No pude leer tiros del CSV. ¿Es el export de FlightScope?");
      return;
    }
    const gs: Group[] = parsed.map((g) => {
      const carries = g.shots.map((s) => s.carryYds).filter((v): v is number => v != null);
      const cls = parseClubName(g.rawClub);
      const flagged = suggestOutliers(carries);
      return {
        rawClub: g.rawClub,
        shots: g.shots,
        carries,
        target: cls.kind === "cell" ? cellKey(cls.wedge, cls.swing) : "RANGE",
        included: carries.map((_, i) => !flagged[i]),
      };
    });
    setGroups(gs);
  }

  function setTarget(i: number, target: string) {
    setGroups((prev) => (prev ? prev.map((g, j) => (j === i ? { ...g, target } : g)) : prev));
  }
  function toggleCarry(gi: number, ci: number) {
    setGroups((prev) =>
      prev ? prev.map((g, j) => (j === gi ? { ...g, included: g.included.map((v, k) => (k === ci ? !v : v)) } : g)) : prev,
    );
  }

  async function save() {
    if (!groups) return;
    setSaving(true);
    setError(null);

    const cellGroups = groups.filter((g) => g.target.includes("__"));
    const rangeGroups = groups.filter((g) => g.target === "RANGE");

    try {
      // 1) celdas de la matriz
      for (const g of cellGroups) {
        const [wedgeType, swingType] = g.target.split("__");
        const kept = g.carries.filter((_, i) => g.included[i]);
        if (kept.length === 0) continue;
        const res = await fetch("/api/wedge-matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wedgeType,
            swingType,
            carries: kept,
            chunksRejected: g.carries.length - kept.length,
            date: new Date(date).toISOString(),
          }),
        });
        if (!res.ok) throw new Error(`Error guardando celda ${g.target}`);
      }

      // 2) palos comunes → una sesión de range
      let rangeMsg = "";
      if (rangeGroups.length > 0) {
        let n = 1;
        const allShots = rangeGroups.flatMap((g) =>
          g.shots.map((s) => ({ ...s, club: normalizeClub(g.rawClub), shotNumber: n++ })),
        );
        if (allShots.length > 0) {
          const res = await fetch("/api/range-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: new Date(date).toISOString(),
              club: normalizeClub(rangeGroups[0].rawClub),
              notes: `Importado de FlightScope (${fileName ?? "CSV"})`,
              shots: allShots,
            }),
          });
          if (!res.ok) throw new Error("Error guardando sesión de range");
          rangeMsg = ` · ${allShots.length} tiros a sesión de range`;
        }
      }

      setResult(`✓ ${cellGroups.length} celda(s) actualizada(s)${rangeMsg}`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[var(--white)] w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gf-section-header flex items-center justify-between sticky top-0 z-10">
          <span>Importar CSV de FlightScope</span>
          <button onClick={onClose} className="text-white/80 text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {!groups && (
            <>
              <p className="text-xs text-[var(--muted)]">
                Subí el <span className="gf-mono">stats.csv</span> que exportaste de MyFlightScope. Los palos
                nombrados con posición (ej. <span className="gf-mono">LW full</span>) caen en la celda; el resto va
                a una sesión de range.
              </p>
              <label className="gf-btn w-full cursor-pointer flex items-center justify-center">
                📄 Elegir CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </label>
              {error && <p className="text-xs text-[var(--red)]">{error}</p>}
            </>
          )}

          {groups && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-wider text-[var(--muted)]">Fecha</label>
                <input type="date" className="gf-input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
                <span className="text-[10px] gf-mono text-[var(--muted)] truncate">{fileName}</span>
              </div>

              {groups.map((g, gi) => {
                const isCell = g.target.includes("__");
                const kept = g.carries.filter((_, i) => g.included[i]);
                const stats = computeCell(kept);
                return (
                  <div
                    key={gi}
                    className="gf-card !p-3 space-y-2"
                    style={{ borderLeft: `4px solid ${isCell ? "var(--accent)" : "var(--green)"}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="gf-display text-lg text-[var(--fairway)]">{g.rawClub}</span>
                      <select
                        className="gf-input !w-auto !text-xs !py-1"
                        value={g.target}
                        onChange={(e) => setTarget(gi, e.target.value)}
                      >
                        <option value="SKIP">— No importar —</option>
                        <option value="RANGE">Sesión de range</option>
                        {CELL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            Celda · {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {g.target === "SKIP" && (
                      <p className="text-[11px] text-[var(--muted)]">{g.shots.length} tiros — ignorado</p>
                    )}

                    {g.target === "RANGE" && (
                      <p className="text-[11px] text-[var(--muted)]">
                        {CLUB_LABEL[normalizeClub(g.rawClub)] ?? normalizeClub(g.rawClub)} · {g.shots.length} tiros → sesión de range
                      </p>
                    )}

                    {isCell && (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {g.carries.map((c, ci) => (
                            <button
                              key={ci}
                              onClick={() => toggleCarry(gi, ci)}
                              className="gf-mono text-xs rounded-full px-2 py-0.5 border"
                              style={
                                g.included[ci]
                                  ? { borderColor: "var(--green)", background: "var(--green-pale)", color: "var(--ink)" }
                                  : { borderColor: "var(--border)", color: "var(--muted)", textDecoration: "line-through" }
                              }
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span>avg <b className="gf-mono">{stats.avg ?? "—"}</b></span>
                          <span style={{ color: toneColor(dispersionTone(stats.dispersion)) }}>
                            gap <b className="gf-mono">{stats.dispersion ?? "—"}</b>
                          </span>
                          <span className="text-[var(--muted)]">{stats.n} tiros {stats.lockedIn ? "🔒" : ""}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {error && <p className="text-xs text-[var(--red)]">{error}</p>}
              {result && <p className="text-xs text-[var(--green)] text-center">{result}</p>}

              <button onClick={save} disabled={saving} className="gf-btn w-full">
                {saving ? "Guardando..." : "💾 Importar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
