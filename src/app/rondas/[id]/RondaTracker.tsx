"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { computeHoleFlags } from "@/lib/scoring-method";
import { strokesPerHole, stablefordPoints } from "@/lib/handicap";

type Hole = {
  number: number;
  par: number;
  hcpHoyo: number;
  yards: number | null;
};

type RoundHoleData = {
  id: string;
  holeNumber: number;
  strokesToEnterSz: number | null;
  distanceInRegYds: number | null;
  strokesInsideSz: number | null;
  putts: number | null;
  firstPuttDistanceFt: number | null;
  puttMadeDistanceFt: number | null;
  puttsInside1PuttCircle: number | null;
  score: number | null;
};

type RoundPlayer = {
  id: string;
  position: number;
  hcpIndex: number | null;
  courseHcp: number | null;
  player: { id: string; name: string; isMe: boolean };
  holes: RoundHoleData[];
};

type Round = {
  id: string;
  date: Date;
  mode: string;
  enterSzYds: number;
  downInSzStrokes: number;
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
  pairs: string | null;
  course: { id: string; name: string; holes: Hole[] };
  players: RoundPlayer[];
};

type FieldKey =
  | "strokesToEnterSz"
  | "distanceInRegYds"
  | "strokesInsideSz"
  | "putts"
  | "firstPuttDistanceFt"
  | "puttMadeDistanceFt"
  | "puttsInside1PuttCircle"
  | "score";

export default function RondaTracker({ round }: { round: Round }) {
  const router = useRouter();
  const [currentHole, setCurrentHole] = useState(1);
  const [busy, setBusy] = useState(false);

  // Estado local: { roundPlayerId: { holeNumber: { field: value } } }
  type CellState = Record<string, Record<number, Partial<Record<FieldKey, number | null>>>>;

  const initial: CellState = useMemo(() => {
    const out: CellState = {};
    for (const rp of round.players) {
      out[rp.id] = {};
      for (const h of rp.holes) {
        out[rp.id][h.holeNumber] = {
          strokesToEnterSz: h.strokesToEnterSz,
          distanceInRegYds: h.distanceInRegYds,
          strokesInsideSz: h.strokesInsideSz,
          putts: h.putts,
          firstPuttDistanceFt: h.firstPuttDistanceFt,
          puttMadeDistanceFt: h.puttMadeDistanceFt,
          puttsInside1PuttCircle: h.puttsInside1PuttCircle,
          score: h.score,
        };
      }
    }
    return out;
  }, [round.players]);

  const [data, setData] = useState<CellState>(initial);

  const meRP = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  const isSolo = round.mode === "SOLO";
  const courseHoles = round.course.holes;
  const currentHoleInfo = courseHoles.find((h) => h.number === currentHole);

  function setCell(rpId: string, hole: number, field: FieldKey, value: string) {
    const num = value === "" ? null : parseInt(value);
    setData((prev) => ({
      ...prev,
      [rpId]: {
        ...prev[rpId],
        [hole]: {
          ...(prev[rpId]?.[hole] ?? {}),
          [field]: num,
        },
      },
    }));
  }

  async function saveAll() {
    setBusy(true);
    const entries = round.players.flatMap((rp) =>
      Object.entries(data[rp.id] ?? {}).map(([h, fields]) => ({
        roundPlayerId: rp.id,
        holeNumber: parseInt(h),
        ...fields,
      })),
    );
    const res = await fetch(`/api/rondas/${round.id}/hoyos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) alert("Error guardando");
    setBusy(false);
    router.refresh();
  }

  // Leaderboard live
  const courseHcpMap = courseHoles.map((h) => ({ number: h.number, par: h.par, hcpHoyo: h.hcpHoyo }));
  const standings = round.players.map((rp) => {
    const hcp = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
    const strokes = strokesPerHole(hcp, courseHcpMap);
    let bruto = 0;
    let neto = 0;
    let stbl = 0;
    let played = 0;
    for (const h of courseHoles) {
      const score = data[rp.id]?.[h.number]?.score;
      if (score != null && score > 0) {
        bruto += score;
        neto += score - (strokes[h.number] ?? 0);
        stbl += stablefordPoints(h.par, score, strokes[h.number] ?? 0);
        played++;
      }
    }
    return {
      rp,
      hcp,
      bruto,
      neto,
      stableford: stbl,
      holesPlayed: played,
    };
  });

  // Match Play 1v1 (solo si TWO_P)
  let matchScore: { a: number; b: number } | null = null;
  if (round.mode === "TWO_P" && round.players.length === 2) {
    const [a, b] = round.players;
    const sa = standings.find((s) => s.rp.id === a.id)!;
    const sb = standings.find((s) => s.rp.id === b.id)!;
    let aWins = 0, bWins = 0;
    for (const h of courseHoles) {
      const scoreA = data[a.id]?.[h.number]?.score;
      const scoreB = data[b.id]?.[h.number]?.score;
      if (scoreA != null && scoreB != null && scoreA > 0 && scoreB > 0) {
        const strokesA = strokesPerHole(sa.hcp, courseHcpMap)[h.number] ?? 0;
        const strokesB = strokesPerHole(sb.hcp, courseHcpMap)[h.number] ?? 0;
        const netA = scoreA - strokesA;
        const netB = scoreB - strokesB;
        if (netA < netB) aWins++;
        else if (netA > netB) bWins++;
      }
    }
    matchScore = { a: aWins, b: bWins };
  }

  const nav = (
    <div className="flex items-center gap-2 sticky top-0 z-30 bg-[var(--sand)] py-2 -mx-4 px-4">
      <button
        onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
        className="gf-btn gf-btn-secondary !px-3"
        disabled={currentHole === 1}
      >
        ‹
      </button>
      <select
        className="gf-input flex-1 text-center font-semibold"
        value={currentHole}
        onChange={(e) => setCurrentHole(parseInt(e.target.value))}
      >
        {courseHoles.map((h) => (
          <option key={h.number} value={h.number}>
            Hoyo {h.number} · Par {h.par}
          </option>
        ))}
      </select>
      <button
        onClick={() => setCurrentHole((h) => Math.min(18, h + 1))}
        className="gf-btn !px-3"
        disabled={currentHole === 18}
      >
        ›
      </button>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      <header className="flex justify-between items-baseline">
        <div>
          <h1 className="gf-display text-2xl text-[var(--fairway)]">
            {round.course.name}
          </h1>
          <p className="text-xs text-[var(--muted)] gf-mono">
            {new Date(round.date).toLocaleDateString("es-AR")} ·{" "}
            SZ {round.enterSzYds}y · Down {round.downInSzStrokes} · 1PC {round.onePuttCircleFt}ft
          </p>
        </div>
        <Link
          href={`/rondas/${round.id}/resumen`}
          className="gf-pill"
        >
          Resumen ›
        </Link>
      </header>

      {/* Leaderboard live (no SOLO) */}
      {!isSolo && (
        <Card className="!p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Leaderboard
            </span>
            {matchScore && (
              <span className="gf-mono text-sm">
                Match: {matchScore.a}–{matchScore.b}
              </span>
            )}
          </div>
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
              {standings.map((s) => (
                <tr key={s.rp.id}>
                  <td>
                    {s.rp.player.name}{" "}
                    {s.rp.player.isMe && <Pill variant="accent">YO</Pill>}
                  </td>
                  <td className="text-right gf-mono">{s.bruto || "—"}</td>
                  <td className="text-right gf-mono">{s.neto || "—"}</td>
                  <td className="text-right gf-mono">{s.stableford}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {nav}

      {/* Tracker del hoyo actual: para Santi (siempre full datos) + score para los demás */}
      {currentHoleInfo && (
        <>
          <SectionHeader>
            Hoyo {currentHole} · Par {currentHoleInfo.par} · HCP {currentHoleInfo.hcpHoyo}
          </SectionHeader>

          {round.players.map((rp) => {
            const cells = data[rp.id]?.[currentHole] ?? {};
            const isMain = rp.id === meRP.id;

            return (
              <Card key={rp.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {rp.player.name}
                    {rp.player.isMe && (
                      <span className="ml-2"><Pill variant="accent">YO</Pill></span>
                    )}
                  </span>
                  {cells.score != null && (
                    <span className="gf-display text-2xl text-[var(--fairway)]">
                      {cells.score}
                    </span>
                  )}
                </div>

                {/* Datos completos solo para "yo" o si es solo 1 jugador */}
                {isMain ? (
                  <div className="grid grid-cols-2 gap-2">
                    <NumField
                      label="Strokes to Enter SZ"
                      value={cells.strokesToEnterSz ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "strokesToEnterSz", v)}
                    />
                    <NumField
                      label="Distancia REG (yds)"
                      value={cells.distanceInRegYds ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "distanceInRegYds", v)}
                    />
                    <NumField
                      label="Strokes inside SZ"
                      value={cells.strokesInsideSz ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "strokesInsideSz", v)}
                    />
                    <NumField
                      label="Putts"
                      value={cells.putts ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "putts", v)}
                    />
                    <NumField
                      label="1st putt (ft)"
                      value={cells.firstPuttDistanceFt ?? null}
                      onChange={(v) =>
                        setCell(rp.id, currentHole, "firstPuttDistanceFt", v)
                      }
                    />
                    <NumField
                      label="Putt embocado (ft)"
                      value={cells.puttMadeDistanceFt ?? null}
                      onChange={(v) =>
                        setCell(rp.id, currentHole, "puttMadeDistanceFt", v)
                      }
                    />
                    <NumField
                      label={`Putts dentro 1PC (${round.onePuttCircleFt}ft)`}
                      value={cells.puttsInside1PuttCircle ?? null}
                      onChange={(v) =>
                        setCell(rp.id, currentHole, "puttsInside1PuttCircle", v)
                      }
                    />
                    <NumField
                      label="Score total"
                      value={cells.score ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                      big
                    />
                  </div>
                ) : (
                  <NumField
                    label="Score total"
                    value={cells.score ?? null}
                    onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                    big
                  />
                )}

                {isMain && (
                  <FlagRow
                    cells={cells}
                    config={{
                      enterSzYds: round.enterSzYds,
                      downInSzStrokes: round.downInSzStrokes,
                      onePuttCircleFt: round.onePuttCircleFt,
                      twoPuttCircleYds: round.twoPuttCircleYds,
                    }}
                    par={currentHoleInfo.par}
                    holeNumber={currentHole}
                  />
                )}
              </Card>
            );
          })}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveAll} disabled={busy} className="gf-btn">
              {busy ? "Guardando..." : "💾 Guardar"}
            </button>
            <button
              onClick={() => {
                saveAll();
                if (currentHole < 18) setCurrentHole(currentHole + 1);
              }}
              className="gf-btn gf-btn-secondary"
            >
              Siguiente hoyo →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  big = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: string) => void;
  big?: boolean;
}) {
  return (
    <div className={big ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        className={`gf-input mt-0.5 ${big ? "text-2xl text-center font-bold" : ""}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FlagRow({
  cells,
  config,
  par,
  holeNumber,
}: {
  cells: Partial<Record<FieldKey, number | null>>;
  config: { enterSzYds: number; downInSzStrokes: number; onePuttCircleFt: number; twoPuttCircleYds: number };
  par: number;
  holeNumber: number;
}) {
  const flags = computeHoleFlags(
    {
      holeNumber,
      par,
      strokesToEnterSz: cells.strokesToEnterSz ?? null,
      distanceInRegYds: cells.distanceInRegYds ?? null,
      strokesInsideSz: cells.strokesInsideSz ?? null,
      putts: cells.putts ?? null,
      firstPuttDistanceFt: cells.firstPuttDistanceFt ?? null,
      puttMadeDistanceFt: cells.puttMadeDistanceFt ?? null,
      puttsInside1PuttCircle: cells.puttsInside1PuttCircle ?? null,
      score: cells.score ?? null,
    },
    config,
  );

  function f(label: string, v: boolean | null) {
    if (v === null) return <span className="text-[var(--muted)] text-[10px]">{label}: —</span>;
    return (
      <span className="text-[10px]">
        {label}: <span className={v ? "gf-flag-ok" : "gf-flag-bad"}>{v ? "✅" : "❌"}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-[var(--green-pale)]">
      {f("Enter SZ", flags.enterSz)}
      {f("Down in SZ", flags.downInSz)}
      {f("3 putts", flags.threePutts)}
      {f("1PC", flags.missedIn1PuttCircle)}
    </div>
  );
}
