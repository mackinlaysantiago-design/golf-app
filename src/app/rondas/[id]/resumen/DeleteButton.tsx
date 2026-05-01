"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("¿Seguro querés eliminar esta ronda? No se puede deshacer.")) return;
    setBusy(true);
    const res = await fetch(`/api/rondas/${roundId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/rondas");
      router.refresh();
    } else {
      alert("Error eliminando");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      className="gf-btn w-full mt-4 text-sm"
      style={{ background: "var(--red)", color: "white" }}
    >
      {busy ? "Eliminando..." : "🗑 Eliminar ronda"}
    </button>
  );
}
