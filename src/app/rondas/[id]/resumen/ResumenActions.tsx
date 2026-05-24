"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditarSetupModal from "../EditarSetupModal";

type Round = Parameters<typeof EditarSetupModal>[0]["round"] & {
  closedAt?: Date | string | null;
};

export default function ResumenActions({ round }: { round: Round }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const isClosed = round.closedAt != null;

  async function toggleClose() {
    setBusy(true);
    await fetch(`/api/rondas/${round.id}/close`, {
      method: isClosed ? "DELETE" : "POST",
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Link href={`/rondas/${round.id}`} className="text-xs text-[var(--muted)]">
        ‹ Tracker en vivo
      </Link>
      <button
        type="button"
        onClick={toggleClose}
        disabled={busy}
        className="gf-pill"
        title={isClosed ? "Reabrir ronda" : "Marcar ronda como cerrada"}
      >
        {isClosed ? "🔓 Reabrir" : "🔒 Cerrar ronda"}
      </button>
      <Link
        href={`/rondas/${round.id}/share`}
        className="gf-pill"
        style={{ background: "var(--fairway)", color: "white" }}
        title="Compartir resumen como imagen"
      >
        📤 Compartir
      </Link>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto gf-pill"
      >
        ⚙️ Editar setup
      </button>
      {open && <EditarSetupModal round={round} onClose={() => setOpen(false)} />}
    </div>
  );
}
