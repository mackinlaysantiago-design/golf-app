"use client";

/**
 * Uploader del CSV de dispersión.
 * Pegás el output de tu chat de FlightScope con Claude, le das submit y se upserta.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

const PLACEHOLDER = `club,n,carry_p25,carry_p50,carry_p90,confidence_pct,lat_p50,pct_right,lat_spread_p90,sessions_count,last_updated
Driver,73,234.2,252.8,270.0,37.0,7.2,61.6,54.5,5,2026-05
7 Iron,47,141.1,146.6,156.7,76.6,0.8,53.2,25.4,2,2026-05
PW,26,100.3,108.0,122.5,61.5,2.3,57.7,11.5,2,2026-05`;

export default function DispersionUploader() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!csv.trim()) {
      setError("Pegá el CSV primero");
      return;
    }
    startTransition(async () => {
      try {
        const resp = await fetch("/api/range/dispersion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setError(data.error || "Error subiendo CSV");
          return;
        }
        setSuccess(`✓ ${data.upserted} palos actualizados`);
        setCsv("");
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
          router.refresh();
        }, 1200);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="gf-btn w-full">
        📋 Actualizar dispersión (pegar CSV)
      </button>
    );
  }

  return (
    <Card className="space-y-2 !p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--fairway)]">Pegá el CSV de dispersión</div>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--muted)] hover:underline">
          Cancelar
        </button>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={8}
        className="gf-input gf-mono text-[11px]"
        spellCheck={false}
      />
      <div className="text-[10px] text-[var(--muted)]">
        Header requerido: <span className="gf-mono">club, n, carry_p25, carry_p50, carry_p90, confidence_pct, lat_p50, pct_right, lat_spread_p90, sessions_count, last_updated</span>
      </div>
      {error && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>}
      {success && <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{success}</div>}
      <button onClick={handleSubmit} disabled={isPending} className="gf-btn w-full">
        {isPending ? "Subiendo…" : "💾 Guardar"}
      </button>
    </Card>
  );
}
