"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LucilaSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/lucila/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `✅ ${data.scraped} socios. ${data.updated} actualizados, ${data.created} nuevos.`,
        );
        router.refresh();
      } else {
        setResult(`❌ Error: ${data.error ?? "desconocido"}`);
      }
    } catch (e) {
      setResult(`❌ ${e instanceof Error ? e.message : "Error"}`);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="gf-btn gf-btn-secondary w-full text-sm"
      >
        {busy ? "Sincronizando..." : "🔄 Sincronizar HCPs Lucila"}
      </button>
      {result && (
        <p className="text-xs text-center text-[var(--muted)]">{result}</p>
      )}
    </div>
  );
}
