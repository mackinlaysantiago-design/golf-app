"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CLUB_LABEL from "@/lib/club-labels";

type Shot = {
  id: string;
  shotNumber: number;
  rowType: string;
  club: string | null;
  carryYds: number | null;
  totalYds: number | null;
  lateralYds: number | null;
  lateralDir: string | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  spinRpm: number | null;
  aoaDeg: number | null;
  shotType: string | null;
};

export default function ShotsTable({
  shots,
  sessionClub,
}: {
  shots: Shot[];
  sessionClub: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function deleteShot(s: Shot) {
    if (!confirm(`¿Borrar shot #${s.shotNumber} (${s.carryYds?.toFixed(1) ?? "—"} yds)?`)) return;
    setBusy(s.id);
    const res = await fetch(`/api/range-shots/${s.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
    else alert("Error borrando");
  }

  return (
    <table className="gf-table" style={{ minWidth: 700 }}>
      <thead>
        <tr>
          <th>#</th>
          <th>Palo</th>
          <th>Carry</th>
          <th>Total</th>
          <th>Lat</th>
          <th>Ball</th>
          <th>Club</th>
          <th>Smash</th>
          <th>Spin</th>
          <th>AoA</th>
          <th>Type</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {shots.map((s) => {
          const club = s.club ?? sessionClub;
          return (
            <tr
              key={s.id}
              className={s.rowType !== "SHOT" ? "font-semibold bg-[var(--green-pale)]" : ""}
            >
              <td className="gf-mono">
                {s.rowType === "SHOT" ? s.shotNumber : s.rowType}
              </td>
              <td className="gf-mono text-[10px]">{CLUB_LABEL[club] ?? club}</td>
              <td className="gf-mono">{s.carryYds?.toFixed(1) ?? "—"}</td>
              <td className="gf-mono">{s.totalYds?.toFixed(1) ?? "—"}</td>
              <td className="gf-mono">
                {s.lateralYds != null ? `${s.lateralYds.toFixed(1)}${s.lateralDir ?? ""}` : "—"}
              </td>
              <td className="gf-mono">{s.ballSpeedMph?.toFixed(1) ?? "—"}</td>
              <td className="gf-mono">{s.clubSpeedMph?.toFixed(1) ?? "—"}</td>
              <td className="gf-mono">{s.smashFactor?.toFixed(2) ?? "—"}</td>
              <td className="gf-mono">{s.spinRpm ?? "—"}</td>
              <td className="gf-mono">{s.aoaDeg?.toFixed(1) ?? "—"}</td>
              <td className="text-xs">{s.shotType ?? "—"}</td>
              <td>
                <button
                  onClick={() => deleteShot(s)}
                  disabled={busy === s.id}
                  className="text-[var(--red)] text-xs px-1"
                  title="Borrar shot"
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
