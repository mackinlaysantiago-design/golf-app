"use client";

import { useState } from "react";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";

type StandingRow = {
  playerId: string;
  name: string;
  isMe: boolean;
  bruto: number;
  neto: number;
  stableford: number;
  hcp: number;
};

type PairRow = {
  label: string;
  playerNames: string[];
  matchPoints: number;
  medalSum: number;
  stbl: number;
};

type Section = "IDA" | "VUELTA" | "TOTAL";

export default function StandingsTabs({
  individual,
  pairs,
}: {
  individual: Record<Section, StandingRow[]>;
  pairs?: Record<Section, [PairRow, PairRow]> | null;
}) {
  const [sec, setSec] = useState<Section>("TOTAL");
  const usePairs = !!pairs;

  return (
    <>
      <SectionHeader>Standings</SectionHeader>
      <Card className="!p-3">
        <div className="flex gap-1 mb-2">
          {(["IDA", "VUELTA", "TOTAL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSec(s)}
              className="flex-1 text-[10px] uppercase tracking-wider py-1 rounded"
              style={{
                background: sec === s ? "var(--fairway)" : "var(--green-pale)",
                color: sec === s ? "white" : "var(--fairway)",
                fontWeight: sec === s ? 700 : 500,
              }}
            >
              {s === "IDA" ? "Ida (1-9)" : s === "VUELTA" ? "Vuelta (10-18)" : "Total"}
            </button>
          ))}
        </div>

        {usePairs && pairs ? (
          <table className="gf-table">
            <thead>
              <tr>
                <th>Pareja</th>
                <th className="text-right">Match</th>
                <th className="text-right">Medal</th>
                <th className="text-right">Stbl</th>
              </tr>
            </thead>
            <tbody>
              {pairs[sec].map((p, i) => {
                const other = pairs[sec][1 - i];
                const diff = p.matchPoints - other.matchPoints;
                return (
                  <tr key={p.label}>
                    <td>
                      <div className="font-semibold">{p.label}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {p.playerNames.join(" · ")}
                      </div>
                    </td>
                    <td className="text-right gf-mono">
                      {p.matchPoints}
                      {diff > 0 && (
                        <span className="text-[var(--green)] text-[10px] ml-1">+{diff}</span>
                      )}
                    </td>
                    <td className="text-right gf-mono">{p.medalSum || "—"}</td>
                    <td className="text-right gf-mono">{p.stbl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="gf-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th className="text-right">Bruto</th>
                <th className="text-right">Neto</th>
                <th className="text-right">Stbl</th>
              </tr>
            </thead>
            <tbody>
              {individual[sec].map((s) => (
                <tr key={s.playerId}>
                  <td>
                    {s.name}{" "}
                    {s.isMe && <Pill variant="accent">YO</Pill>}
                  </td>
                  <td className="text-right gf-mono">{s.bruto || "—"}</td>
                  <td className="text-right gf-mono">{s.neto || "—"}</td>
                  <td className="text-right gf-mono">{s.stableford}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
