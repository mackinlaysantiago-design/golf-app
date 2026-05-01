import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { computeRoundKPIs, computePPPlan, type HoleData } from "@/lib/scoring-method";
import { strokesPerHole, stablefordPoints } from "@/lib/handicap";
import { computeBetWinner, MODALITY_LABEL, type BetModality } from "@/lib/bets";
import { Card, KPI, SectionHeader, Pill } from "@/components/ui/Card";
import Link from "next/link";
import AnalisisIA from "./AnalisisIA";

export const dynamic = "force-dynamic";

export default async function ResumenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
      bets: true,
    },
  });

  if (!round) return notFound();

  const me = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  const parByNumber = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const holes: HoleData[] = me.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: parByNumber.get(h.holeNumber) ?? 4,
    strokesToEnterSz: h.strokesToEnterSz,
    distanceInRegYds: h.distanceInRegYds,
    strokesInsideSz: h.strokesInsideSz,
    putts: h.putts,
    firstPuttDistanceFt: h.firstPuttDistanceFt,
    puttMadeDistanceFt: h.puttMadeDistanceFt,
    puttsInside1PuttCircle: h.puttsInside1PuttCircle,
    score: h.score,
  }));

  const config = {
    enterSzYds: round.enterSzYds,
    downInSzStrokes: round.downInSzStrokes,
    onePuttCircleFt: round.onePuttCircleFt,
    twoPuttCircleYds: round.twoPuttCircleYds,
  };
  const kpis = computeRoundKPIs(holes, config);
  const ppPlan = computePPPlan(holes, config, kpis);

  // Standings (todos los jugadores)
  const courseHcpMap = round.course.holes.map((h) => ({
    number: h.number,
    par: h.par,
    hcpHoyo: h.hcpHoyo,
  }));

  // Calcular apuestas si hay
  const playerScoresForBets = round.players.map((rp) => {
    const scoresByHole: Record<number, number | null> = {};
    for (const h of round.course.holes) {
      const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
      scoresByHole[h.number] = hd?.score ?? null;
    }
    return {
      playerId: rp.id, // usar RoundPlayer.id como identificador
      name: rp.player.name,
      isMe: rp.player.isMe,
      hcp: rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0),
      scoresByHole,
    };
  });

  type BetResult = {
    modality: string;
    label: string;
    amount: number;
    winnerNames: string[];
    tie: boolean;
    scores: { playerId: string; value: number; display: string }[];
    payouts: Record<string, number>; // playerId -> ±monto
  };
  const pairsParsed: string[][] | undefined = round.pairs
    ? (() => {
        try {
          // Las parejas guardan player.id (no roundPlayer.id) — convertir
          const raw: string[][] = JSON.parse(round.pairs);
          return raw.map((pair) =>
            pair
              .map((pid) => round.players.find((rp) => rp.player.id === pid)?.id)
              .filter((id): id is string => Boolean(id)),
          );
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const betResults: BetResult[] = round.bets.map((b) => {
    const result = computeBetWinner(
      b.modality as BetModality,
      playerScoresForBets,
      courseHcpMap,
      pairsParsed,
    );
    const winnerNames = result.winnerIds.map(
      (id) => playerScoresForBets.find((p) => p.playerId === id)?.name ?? "?",
    );
    // Payouts: cada ganador cobra (losers*amount / winners). Cada loser paga amount.
    const payouts: Record<string, number> = {};
    if (result.winnerIds.length >= 1 && !result.tie) {
      const winners = result.winnerIds;
      const losers = playerScoresForBets
        .filter((p) => !winners.includes(p.playerId))
        .map((p) => p.playerId);
      const pot = losers.length * b.amount;
      const perWinner = pot / winners.length;
      for (const w of winners) payouts[w] = perWinner;
      for (const l of losers) payouts[l] = -b.amount;
    }
    return {
      modality: b.modality,
      label: MODALITY_LABEL[b.modality as BetModality] ?? b.modality,
      amount: b.amount,
      winnerNames,
      tie: result.tie,
      scores: result.scores,
      payouts,
    };
  });

  // Total por jugador
  const totalsByPlayer: Record<string, number> = {};
  for (const rp of round.players) totalsByPlayer[rp.id] = 0;
  for (const r of betResults) {
    for (const [pid, amt] of Object.entries(r.payouts)) {
      totalsByPlayer[pid] = (totalsByPlayer[pid] ?? 0) + amt;
    }
  }
  const standings = round.players.map((rp) => {
    const hcp = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
    const strokes = strokesPerHole(hcp, courseHcpMap);
    let bruto = 0, neto = 0, stbl = 0;
    for (const h of round.course.holes) {
      const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
      if (hd?.score && hd.score > 0) {
        bruto += hd.score;
        neto += hd.score - (strokes[h.number] ?? 0);
        stbl += stablefordPoints(h.par, hd.score, strokes[h.number] ?? 0);
      }
    }
    return { rp, hcp, bruto, neto, stableford: stbl };
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href={`/rondas/${round.id}`} className="text-xs text-[var(--muted)]">
          ‹ Volver al tracker
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          {round.course.name}
        </h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(round.date).toLocaleDateString("es-AR")} · SZ {round.enterSzYds}y · Down {round.downInSzStrokes}
        </p>
      </header>

      <SectionHeader>KPIs Scoring Method</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        <KPI
          label="Score"
          value={kpis.totalScore}
          hint={`${kpis.scoreVsPar >= 0 ? "+" : ""}${kpis.scoreVsPar} vs par`}
          tone={kpis.scoreVsPar <= 0 ? "good" : kpis.scoreVsPar <= 6 ? "neutral" : "warn"}
        />
        <KPI
          label="Sin doble bogey"
          value={`${kpis.pctNoDoubleBogey.toFixed(0)}%`}
          hint={`${kpis.holesWithDoubleOrWorse} hoyos con doble+`}
          tone={kpis.pctNoDoubleBogey >= 75 ? "good" : "warn"}
        />
        <KPI
          label="Enter SZ"
          value={`${kpis.enterSzCount}/${kpis.holesPlayed}`}
          hint={`≤ ${round.enterSzYds} yds`}
        />
        <KPI
          label="Down in SZ"
          value={`${kpis.downInSzCount}/${kpis.holesPlayed}`}
          hint={`≤ ${round.downInSzStrokes} golpes`}
        />
        <KPI
          label="Putts totales"
          value={kpis.totalPutts}
          hint={`${kpis.avgPuttsPerHole.toFixed(1)}/hoyo`}
        />
        <KPI
          label="3-putts"
          value={kpis.threePuttsHoles}
          tone={kpis.threePuttsHoles === 0 ? "good" : "bad"}
        />
      </div>

      {/* Distribución Enter SZ */}
      <SectionHeader>Distribución Enter SZ (yds al hoyo)</SectionHeader>
      <Card className="!p-3">
        <table className="gf-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th className="text-right">Hoyos</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>&gt;100 yds</td><td className="text-right gf-mono">{kpis.enterSzBuckets.over100}</td></tr>
            <tr><td>≤100 yds</td><td className="text-right gf-mono">{kpis.enterSzBuckets.under100}</td></tr>
            <tr><td>≤50 yds</td><td className="text-right gf-mono">{kpis.enterSzBuckets.under50}</td></tr>
            <tr><td>≤25 yds</td><td className="text-right gf-mono">{kpis.enterSzBuckets.under25}</td></tr>
            <tr><td>GIR (0)</td><td className="text-right gf-mono">{kpis.enterSzBuckets.gir}</td></tr>
          </tbody>
        </table>
      </Card>

      {/* Distribución Down in SZ */}
      <SectionHeader>Down in SZ (golpes desde SZ)</SectionHeader>
      <Card className="!p-3">
        <table className="gf-table">
          <thead>
            <tr><th>Golpes</th><th className="text-right">Hoyos</th></tr>
          </thead>
          <tbody>
            <tr><td>≥5</td><td className="text-right gf-mono">{kpis.downInSzBuckets.over5}</td></tr>
            <tr><td>4</td><td className="text-right gf-mono">{kpis.downInSzBuckets.s4}</td></tr>
            <tr><td>3</td><td className="text-right gf-mono">{kpis.downInSzBuckets.s3}</td></tr>
            <tr><td>2</td><td className="text-right gf-mono">{kpis.downInSzBuckets.s2}</td></tr>
            <tr><td>1</td><td className="text-right gf-mono">{kpis.downInSzBuckets.s1}</td></tr>
            <tr><td>0</td><td className="text-right gf-mono">{kpis.downInSzBuckets.s0}</td></tr>
          </tbody>
        </table>
      </Card>

      {/* PP Plan */}
      <SectionHeader>PP Plan · Practicar próxima</SectionHeader>
      <div className="space-y-2">
        {ppPlan.map((p) => (
          <Card key={p.code} className="!p-3" style={{ borderLeft: `4px solid ${p.count > 0 ? "var(--accent)" : "var(--green)"}` }}>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-sm">{p.label}</span>
              <span className="gf-display text-2xl">{p.count}</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">{p.reason}</div>
          </Card>
        ))}
      </div>

      {/* Apuestas */}
      {betResults.length > 0 && (
        <>
          <SectionHeader>Apuestas</SectionHeader>
          <div className="space-y-2">
            {betResults.map((br) => (
              <Card key={br.modality} className="!p-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">{br.label}</span>
                  <span className="gf-mono text-xs text-[var(--muted)]">
                    ${br.amount.toLocaleString("es-AR")} c/u
                  </span>
                </div>
                <div className="mt-1 text-xs">
                  {br.tie ? (
                    <Pill variant="accent">Empate · sin ganador</Pill>
                  ) : br.winnerNames.length === 1 ? (
                    <span>
                      Ganó <strong>{br.winnerNames[0]}</strong> · cobra ${" "}
                      {(br.amount * (round.players.length - 1)).toLocaleString("es-AR")}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">— sin definir</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] gf-mono text-[var(--muted)]">
                  {br.scores.map((s, i) => {
                    const rp = round.players.find((rp) => rp.id === s.playerId);
                    return (
                      <span key={s.playerId}>
                        {i > 0 && " · "}
                        {rp?.player.name}: {s.display}
                      </span>
                    );
                  })}
                </div>
              </Card>
            ))}
            <Card className="!p-3">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                Saldo final por jugador
              </div>
              {round.players.map((rp) => {
                const total = totalsByPlayer[rp.id] ?? 0;
                return (
                  <div
                    key={rp.id}
                    className="flex justify-between items-center py-1 border-b border-[var(--green-pale)] last:border-0"
                  >
                    <span className="text-sm">
                      {rp.player.name}
                      {rp.player.isMe && <span className="ml-1"><Pill variant="accent">YO</Pill></span>}
                    </span>
                    <span
                      className="gf-mono font-bold"
                      style={{
                        color:
                          total > 0
                            ? "var(--green)"
                            : total < 0
                            ? "var(--red)"
                            : "var(--muted)",
                      }}
                    >
                      {total > 0 ? "+" : ""}${total.toLocaleString("es-AR")}
                    </span>
                  </div>
                );
              })}
            </Card>
          </div>
        </>
      )}

      {/* Análisis IA */}
      <AnalisisIA roundId={round.id} />

      {/* Scorecard tabla full */}
      <SectionHeader>Scorecard</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        <table className="gf-table" style={{ minWidth: 320 + standings.length * 70 }}>
          <thead>
            <tr>
              <th>Hoyo</th>
              <th>Par</th>
              {standings.map((s) => (
                <th key={s.rp.id} className="text-right">
                  {s.rp.player.name}
                  {s.rp.player.isMe && " ⛳"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {round.course.holes.map((h) => (
              <tr key={h.number}>
                <td className="gf-mono">{h.number}</td>
                <td className="gf-mono">{h.par}</td>
                {round.players.map((rp) => {
                  const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
                  const score = hd?.score;
                  const vsPar = score && score > 0 ? score - h.par : null;
                  const cls = vsPar == null
                    ? "text-[var(--muted)]"
                    : vsPar < 0 ? "text-[var(--green)] font-bold"
                    : vsPar === 0 ? ""
                    : vsPar === 1 ? "text-[var(--accent)]"
                    : "text-[var(--red)] font-bold";
                  return (
                    <td key={rp.id} className={`text-right gf-mono ${cls}`}>
                      {score && score > 0 ? score : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="font-bold">
              <td>Total</td>
              <td className="gf-mono">
                {round.course.holes.reduce((s, h) => s + h.par, 0)}
              </td>
              {standings.map((s) => (
                <td key={s.rp.id} className="text-right gf-mono">
                  {s.bruto || "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
