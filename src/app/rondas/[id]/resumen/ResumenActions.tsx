"use client";

import { useState } from "react";
import Link from "next/link";
import EditarSetupModal from "../EditarSetupModal";

type Round = Parameters<typeof EditarSetupModal>[0]["round"];

export default function ResumenActions({ round }: { round: Round }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Link href={`/rondas/${round.id}`} className="text-xs text-[var(--muted)]">
        ‹ Tracker en vivo
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
