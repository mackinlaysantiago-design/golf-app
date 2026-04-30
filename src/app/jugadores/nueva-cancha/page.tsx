"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";

const DEFAULT_LA_LUCILA = [
  { number: 1, par: 4, hcpHoyo: 3, yards: null },
  { number: 2, par: 4, hcpHoyo: 17, yards: null },
  { number: 3, par: 4, hcpHoyo: 5, yards: null },
  { number: 4, par: 4, hcpHoyo: 1, yards: null },
  { number: 5, par: 3, hcpHoyo: 11, yards: null },
  { number: 6, par: 4, hcpHoyo: 7, yards: null },
  { number: 7, par: 5, hcpHoyo: 13, yards: null },
  { number: 8, par: 3, hcpHoyo: 15, yards: null },
  { number: 9, par: 5, hcpHoyo: 9, yards: null },
  { number: 10, par: 4, hcpHoyo: 8, yards: null },
  { number: 11, par: 3, hcpHoyo: 4, yards: null },
  { number: 12, par: 4, hcpHoyo: 6, yards: null },
  { number: 13, par: 4, hcpHoyo: 12, yards: null },
  { number: 14, par: 3, hcpHoyo: 10, yards: null },
  { number: 15, par: 5, hcpHoyo: 18, yards: null },
  { number: 16, par: 4, hcpHoyo: 2, yards: null },
  { number: 17, par: 3, hcpHoyo: 16, yards: null },
  { number: 18, par: 5, hcpHoyo: 14, yards: null },
];

export default function NuevaCanchaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [holes, setHoles] = useState(DEFAULT_LA_LUCILA);
  const [busy, setBusy] = useState(false);

  function update(i: number, field: "par" | "hcpHoyo" | "yards", v: string) {
    setHoles((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, [field]: v ? parseInt(v) : field === "yards" ? null : h[field] } : h)),
    );
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/canchas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), holes }),
    });
    if (res.ok) {
      router.push("/jugadores");
      router.refresh();
    } else {
      alert("Error guardando cancha");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva cancha</h1>
        <p className="text-sm text-[var(--muted)]">Default: La Lucila — editá pars/HCP si querés</p>
      </header>

      <Card>
        <input
          className="gf-input"
          placeholder="Nombre cancha"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Card>

      <SectionHeader>18 Hoyos</SectionHeader>
      <Card>
        <div className="grid grid-cols-[1fr_60px_60px_70px] gap-2 text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
          <div>Hoyo</div>
          <div>Par</div>
          <div>HCP</div>
          <div>Yds</div>
        </div>
        {holes.map((h, i) => (
          <div
            key={h.number}
            className="grid grid-cols-[1fr_60px_60px_70px] gap-2 mb-2 items-center"
          >
            <div className="font-medium gf-mono">{h.number}</div>
            <input
              className="gf-input !p-2 text-center"
              type="number"
              value={h.par}
              onChange={(e) => update(i, "par", e.target.value)}
            />
            <input
              className="gf-input !p-2 text-center"
              type="number"
              value={h.hcpHoyo}
              onChange={(e) => update(i, "hcpHoyo", e.target.value)}
            />
            <input
              className="gf-input !p-2 text-center"
              type="number"
              placeholder="—"
              value={h.yards ?? ""}
              onChange={(e) => update(i, "yards", e.target.value)}
            />
          </div>
        ))}
      </Card>

      <button onClick={save} disabled={busy} className="gf-btn w-full">
        {busy ? "Guardando..." : "Guardar cancha"}
      </button>
    </div>
  );
}
