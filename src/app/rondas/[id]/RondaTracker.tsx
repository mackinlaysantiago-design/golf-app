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
  modalityHcps?: unknown;
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
    setData((prev) => {
      const cur = prev[rpId]?.[hole] ?? {};
      const updated = { ...cur, [field]: num };

      // Auto-cálculo del score para el jugador main: strokesToEnterSz + strokesInsideSz
      const isMainPlayer = rpId === meRP.id;
      if (
        isMainPlayer &&
        (field === "strokesToEnterSz" || field === "strokesInsideSz")
      ) {
        const a = field === "strokesToEnterSz" ? num : updated.strokesToEnterSz;
        const b = field === "strokesInsideSz" ? num : updated.strokesInsideSz;
        if (a != null && b != null) {
          updated.score = a + b;
        }
      }

      return {
        ...prev,
        [rpId]: { ...prev[rpId], [hole]: updated },
      };
    });
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

  // Parsing de parejas (4P 2v2)
  type PairStanding = {
    label: string;
    playerNames: string[];
    matchPoints: number; // BB+WB acumulados
    medalSum: number;    // suma de netos de los dos
    stbl: number;        // stableford acumulado
    holesPlayed: number;
  };
  let pairsStandings: [PairStanding, PairStanding] | null = null;
  if (round.mode === "FOUR_P" && round.pairs) {
    try {
      const pairsJSON: string[][] = JSON.parse(round.pairs);
      if (pairsJSON.length === 2 && pairsJSON.every((p) => p.length === 2)) {
        // Map player.id -> RoundPlayer
        const rpByPlayerId = new Map(round.players.map((rp) => [rp.player.id, rp]));
        const pairAR = pairsJSON[0].map((pid) => rpByPlayerId.get(pid)!).filter(Boolean);
        const pairBR = pairsJSON[1].map((pid) => rpByPlayerId.get(pid)!).filter(Boolean);

        if (pairAR.length === 2 && pairBR.length === 2) {
          let matchA = 0;
          let matchB = 0;
          let medalA = 0;
          let medalB = 0;
          let stblA = 0;
          let stblB = 0;
          let played = 0;

          for (const h of courseHoles) {
            const netsForPair = (rps: typeof pairAR) =>
              rps
                .map((rp) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return null;
                  const hcp = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
                  const strokes = strokesPerHole(hcp, courseHcpMap)[h.number] ?? 0;
                  return sc - strokes;
                })
                .filter((n): n is number => n != null);
            const stblForPair = (rps: typeof pairAR) =>
              rps
                .map((rp) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return 0;
                  const hcp = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
                  const strokes = strokesPerHole(hcp, courseHcpMap)[h.number] ?? 0;
                  return stablefordPoints(h.par, sc, strokes);
                })
                .reduce((s, v) => s + v, 0);

            const netsA = netsForPair(pairAR);
            const netsB = netsForPair(pairBR);

            stblA += stblForPair(pairAR);
            stblB += stblForPair(pairBR);

            if (netsA.length === 2 && netsB.length === 2) {
              played++;
              medalA += netsA[0] + netsA[1];
              medalB += netsB[0] + netsB[1];
              const minA = Math.min(...netsA);
              const maxA = Math.max(...netsA);
              const minB = Math.min(...netsB);
              const maxB = Math.max(...netsB);
              if (minA < minB) matchA += 2;
              else if (minB < minA) matchB += 2;
              if (maxA < maxB) matchA += 1;
              else if (maxB < maxA) matchB += 1;
            }
          }

          pairsStandings = [
            {
              label: "Pareja A",
              playerNames: pairAR.map((rp) => rp.player.name),
              matchPoints: matchA,
              medalSum: medalA,
              stbl: stblA,
              holesPlayed: played,
            },
            {
              label: "Pareja B",
              playerNames: pairBR.map((rp) => rp.player.name),
              matchPoints: matchB,
              medalSum: medalB,
              stbl: stblB,
              holesPlayed: played,
            },
          ];
        }
      }
    } catch {}
  }

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
            {pairsStandings ? (
              <span className="gf-mono text-sm">
                {pairMatchDisplay(pairsStandings)}
              </span>
            ) : matchScore ? (
              <span className="gf-mono text-sm">
                Match: {matchScore.a}–{matchScore.b}
              </span>
            ) : null}
          </div>

          {pairsStandings ? (
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
                {pairsStandings.map((p, i) => {
                  const other = pairsStandings![1 - i];
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
                          <span className="text-[var(--green)] text-[10px] ml-1">
                            +{diff}
                          </span>
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
          )}
        </Card>
      )}

      {/* Tabla de CHs por modalidad — referencia */}
      {round.players.some((rp) => rp.modalityHcps) && (
        <Card className="!p-2">
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1 text-center">
            Course HCP por modalidad
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left p-0.5 text-[var(--muted)]">Mod.</th>
                {round.players.map((rp) => (
                  <th key={rp.id} className="p-0.5 text-center text-[var(--muted)]">
                    {rp.player.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["MEDAL", "MEDAL_IDA", "MEDAL_VUELTA", "STABLEFORD", "STABLEFORD_IDA", "STABLEFORD_VUELTA"] as const).map(
                (mod) => (
                  <tr key={mod} className="border-t border-[var(--green-pale)]">
                    <td className="p-0.5 gf-mono text-[var(--muted)]">
                      {mod === "MEDAL" ? "Medal Tot" : mod === "MEDAL_IDA" ? "Medal Ida" : mod === "MEDAL_VUELTA" ? "Medal Vta" : mod === "STABLEFORD" ? "Stbl Tot" : mod === "STABLEFORD_IDA" ? "Stbl Ida" : "Stbl Vta"}
                    </td>
                    {round.players.map((rp) => {
                      const chs = rp.modalityHcps as Record<string, number> | null;
                      const v = chs?.[mod];
                      return (
                        <td key={rp.id} className="p-0.5 text-center gf-mono">
                          {v != null ? v : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <div className="text-[9px] text-[var(--muted)] mt-1 text-center">
            * Medal CH usa stroke allocation hoyo a hoyo. Stableford usa Stableford CH.
          </div>
        </Card>
      )}

      {nav}

      {/* Tracker del hoyo actual: para Santi (siempre full datos) + score para los demás */}
      {currentHoleInfo && (
        <>
          <SectionHeader>
            Hoyo {currentHole} · Par {currentHoleInfo.par} · HCP {currentHoleInfo.hcpHoyo}
          </SectionHeader>
          {/* Quién tiene golpe en este hoyo */}
          {(() => {
            const strokesAt = round.players.map((rp) => {
              const hcp = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
              const s = strokesPerHole(hcp, courseHcpMap)[currentHole] ?? 0;
              return { name: rp.player.name, isMe: rp.player.isMe, strokes: s };
            });
            const withStrokes = strokesAt.filter((x) => x.strokes !== 0);
            if (withStrokes.length === 0) {
              return (
                <Card className="!p-2 text-center">
                  <span className="text-[11px] text-[var(--muted)]">
                    Nadie tiene golpe en este hoyo
                  </span>
                </Card>
              );
            }
            return (
              <Card className="!p-2">
                <div className="flex flex-wrap gap-1.5 items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Golpes:
                  </span>
                  {withStrokes.map((x) => (
                    <span
                      key={x.name}
                      className="gf-pill gf-mono"
                      style={{
                        background: x.strokes > 0 ? "var(--accent-light)" : "#fde0dc",
                        color: x.strokes > 0 ? "var(--accent)" : "var(--red)",
                      }}
                    >
                      {x.name.split(" ")[0]} {x.strokes > 0 ? "+" : ""}{x.strokes}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })()}

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
                      showGir
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
                      label="Score total (auto = enter + inside)"
                      value={cells.score ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                      big
                      isLast
                    />
                  </div>
                ) : (
                  <NumField
                    label="Score total"
                    value={cells.score ?? null}
                    onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                    big
                    isLast
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

          <button
            onClick={async () => {
              await saveAll();
              router.push(`/rondas/${round.id}/resumen`);
            }}
            className="gf-btn w-full mt-2"
            style={{ background: "var(--accent)", color: "var(--ink)" }}
          >
            🏁 Finalizar ronda y ver resumen
          </button>
        </>
      )}
    </div>
  );
}

function pairMatchDisplay(
  pairs: { label: string; matchPoints: number; holesPlayed: number }[],
): string {
  const [a, b] = pairs;
  const diff = a.matchPoints - b.matchPoints;
  if (diff === 0) return "All Square";
  const winner = diff > 0 ? a.label : b.label;
  return `${winner} ${Math.abs(diff)} arriba`;
}

function NumField({
  label,
  value,
  onChange,
  big = false,
  showGir = false,
  isLast = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: string) => void;
  big?: boolean;
  showGir?: boolean;
  isLast?: boolean;
}) {
  function focusNext(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input.gf-numfield"),
    );
    const cur = inputs.indexOf(e.currentTarget);
    if (cur === -1) return;
    const next = inputs[cur + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      e.currentTarget.blur();
    }
  }

  const isGir = showGir && value === 0;

  return (
    <div className={big ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
        {label}
        {isGir && (
          <span className="gf-pill gf-pill-accent !py-0 !px-1.5 text-[9px]">
            GIR ✅
          </span>
        )}
      </label>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint={isLast ? "done" : "next"}
        className={`gf-input gf-numfield mt-0.5 ${big ? "text-2xl text-center font-bold" : ""}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={focusNext}
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
