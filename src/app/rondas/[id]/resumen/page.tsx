import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { computeRoundKPIs, computePPPlan, type HoleData } from "@/lib/scoring-method";
import { strokesPerHole, stablefordPoints } from "@/lib/handicap";
import { computeBetWinner, MODALITY_LABEL, type BetModality } from "@/lib/bets";
import { Card, KPI, SectionHeader, Pill } from "@/components/ui/Card";
import Link from "next/link";
import DeleteButton from "./DeleteButton";
import ResumenActions from "./ResumenActions";
import StandingsTabs from "./StandingsTabs";
import LevelUpCard, { type PerfectRun } from "./LevelUpCard";
import { nextLevel, type SmField } from "@/lib/sm-levels";

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
  const r = round; // narrow non-null

  const me = r.players.find((rp) => rp.player.isMe) ?? r.players[0];
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

  // Detectar perfect runs solo si "me" es el jugador de isMe (Santi),
  // y mostrar el card para subir nivel. Mínimo 14 hoyos con datos.
  const MIN_HOLES = 14;
  const perfectRuns: PerfectRun[] = [];
  const alreadyApplied: SmField[] = [];
  if (me.player.isMe) {
    const checks: { field: SmField; label: string; ok: boolean; cumplidos: number; total: number }[] = [
      {
        field: "enterSzYds",
        label: "Enter SZ",
        ok: kpis.enterSzDataHoles >= MIN_HOLES && kpis.enterSzCount === kpis.enterSzDataHoles,
        cumplidos: kpis.enterSzCount,
        total: kpis.enterSzDataHoles,
      },
      {
        field: "downInSzStrokes",
        label: "Down in SZ",
        ok: kpis.downInSzDataHoles >= MIN_HOLES && kpis.downInSzCount === kpis.downInSzDataHoles,
        cumplidos: kpis.downInSzCount,
        total: kpis.downInSzDataHoles,
      },
      {
        field: "onePuttCircleFt",
        label: "1-Putt Circle",
        ok:
          kpis.onePuttCircleDataHoles >= MIN_HOLES &&
          kpis.missedIn1PuttCircleHoles === 0,
        cumplidos: kpis.onePuttCircleDataHoles - kpis.missedIn1PuttCircleHoles,
        total: kpis.onePuttCircleDataHoles,
      },
      {
        field: "twoPuttCircleYds",
        label: "2-Putt Circle (sin 3-putts)",
        ok: kpis.puttsDataHoles >= MIN_HOLES && kpis.threePuttsHoles === 0,
        cumplidos: kpis.puttsDataHoles - kpis.threePuttsHoles,
        total: kpis.puttsDataHoles,
      },
    ];
    const meFull = await prisma.player.findUnique({ where: { id: me.player.id } });
    for (const c of checks) {
      if (!c.ok) continue;
      const currentLevel = config[c.field];
      const next = nextLevel(c.field, currentLevel);
      if (next == null) continue;
      perfectRuns.push({
        field: c.field,
        label: c.label,
        current: currentLevel,
        next,
        cumplidos: c.cumplidos,
        total: c.total,
      });
      // Si el Player ya tiene este field == next, asumimos que ya aplicó el level-up
      if (meFull && meFull[c.field] === next) {
        alreadyApplied.push(c.field);
      }
    }
  }

  // Standings (todos los jugadores)
  const courseHcpMap = round.course.holes.map((h) => ({
    number: h.number,
    par: h.par,
    hcpHoyo: h.hcpHoyo,
  }));

  type Section = "IDA" | "VUELTA" | "TOTAL";
  const allCourseHoles = r.course.holes;
  function holesForSection(sec: Section) {
    if (sec === "IDA") return allCourseHoles.filter((h) => h.number <= 9);
    if (sec === "VUELTA") return allCourseHoles.filter((h) => h.number >= 10);
    return allCourseHoles;
  }
  function chForSection(rp: typeof r.players[number], sec: Section) {
    const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
    const fb = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
    const medalCh = sec === "IDA"
      ? mh?.MEDAL_IDA ?? fb
      : sec === "VUELTA"
      ? mh?.MEDAL_VUELTA ?? fb
      : mh?.MEDAL ?? fb;
    const stblCh = mh?.STABLEFORD ?? fb;
    return { medalCh, stblCh };
  }
  function standingsBySection(sec: Section) {
    const sectionHoles = holesForSection(sec);
    return r.players.map((rp) => {
      const { medalCh, stblCh } = chForSection(rp, sec);
      const medalStrokes = strokesPerHole(medalCh, courseHcpMap);
      const stblStrokes = strokesPerHole(stblCh, courseHcpMap);
      let bruto = 0, neto = 0, stbl = 0;
      for (const h of sectionHoles) {
        const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
        const sc = hd?.score;
        if (sc != null && sc > 0) {
          bruto += sc;
          neto += sc - (medalStrokes[h.number] ?? 0);
          stbl += stablefordPoints(h.par, sc, stblStrokes[h.number] ?? 0);
        }
      }
      return {
        playerId: rp.id,
        name: rp.player.name,
        isMe: rp.player.isMe,
        bruto,
        neto,
        stableford: stbl,
        hcp: medalCh,
      };
    });
  }
  const standingsBySec: Record<Section, ReturnType<typeof standingsBySection>> = {
    IDA: standingsBySection("IDA"),
    VUELTA: standingsBySection("VUELTA"),
    TOTAL: standingsBySection("TOTAL"),
  };

  // Pairs por sección
  type PairRow = {
    label: string;
    playerNames: string[];
    matchPoints: number;
    medalSum: number;
    stbl: number;
  };
  function computePairsForSection(sec: Section): [PairRow, PairRow] | null {
    if (r.mode !== "FOUR_P" || !r.pairs) return null;
    try {
      const pairsJSON: string[][] = JSON.parse(r.pairs);
      if (pairsJSON.length !== 2) return null;
      const rpByPlayerId = new Map(r.players.map((rp) => [rp.player.id, rp]));
      const pairAR = pairsJSON[0].map((pid) => rpByPlayerId.get(pid)).filter((x): x is NonNullable<typeof x> => Boolean(x));
      const pairBR = pairsJSON[1].map((pid) => rpByPlayerId.get(pid)).filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (pairAR.length !== 2 || pairBR.length !== 2) return null;

      const sectionHoles = holesForSection(sec);
      let mA = 0, mB = 0, medA = 0, medB = 0, sA = 0, sB = 0;
      for (const h of sectionHoles) {
        const netForMedal = (rp: typeof pairAR[number]) => {
          const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
          if (!hd?.score) return null;
          const { medalCh } = chForSection(rp, sec);
          const strokes = strokesPerHole(medalCh, courseHcpMap)[h.number] ?? 0;
          return hd.score - strokes;
        };
        const netForMatch = (rp: typeof pairAR[number]) => {
          const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
          if (!hd?.score) return null;
          const { stblCh } = chForSection(rp, sec);
          const strokes = strokesPerHole(stblCh, courseHcpMap)[h.number] ?? 0;
          return hd.score - strokes;
        };
        const stblFor = (rp: typeof pairAR[number]) => {
          const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
          if (!hd?.score) return 0;
          const { stblCh } = chForSection(rp, sec);
          const strokes = strokesPerHole(stblCh, courseHcpMap)[h.number] ?? 0;
          return stablefordPoints(h.par, hd.score, strokes);
        };

        const medA1 = pairAR.map(netForMedal).filter((n): n is number => n != null);
        const medB1 = pairBR.map(netForMedal).filter((n): n is number => n != null);
        const matA1 = pairAR.map(netForMatch).filter((n): n is number => n != null);
        const matB1 = pairBR.map(netForMatch).filter((n): n is number => n != null);
        sA += pairAR.reduce((s, rp) => s + stblFor(rp), 0);
        sB += pairBR.reduce((s, rp) => s + stblFor(rp), 0);
        if (medA1.length === 2 && medB1.length === 2) {
          medA += medA1[0] + medA1[1];
          medB += medB1[0] + medB1[1];
        }
        if (matA1.length === 2 && matB1.length === 2) {
          const minA = Math.min(...matA1), maxA = Math.max(...matA1);
          const minB = Math.min(...matB1), maxB = Math.max(...matB1);
          if (minA < minB) mA += 2; else if (minB < minA) mB += 2;
          if (maxA < maxB) mA += 1; else if (maxB < maxA) mB += 1;
        }
      }
      return [
        { label: "Pareja A", playerNames: pairAR.map((rp) => rp.player.name), matchPoints: mA, medalSum: medA, stbl: sA },
        { label: "Pareja B", playerNames: pairBR.map((rp) => rp.player.name), matchPoints: mB, medalSum: medB, stbl: sB },
      ];
    } catch {
      return null;
    }
  }
  const pairsBySec = r.mode === "FOUR_P" && r.pairs
    ? {
        IDA: computePairsForSection("IDA")!,
        VUELTA: computePairsForSection("VUELTA")!,
        TOTAL: computePairsForSection("TOTAL")!,
      }
    : null;

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
      modalityHcps: (rp.modalityHcps as Record<string, number> | null) ?? null,
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
  // standings para el scorecard tabla (al final) — usa TOTAL
  const standings = standingsBySec.TOTAL.map((s) => {
    const rp = round.players.find((rp) => rp.id === s.playerId)!;
    return { rp, hcp: s.hcp, bruto: s.bruto, neto: s.neto, stableford: s.stableford };
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="space-y-2">
        <ResumenActions round={round} />
        <h1 className="gf-display text-3xl text-[var(--fairway)]">
          {round.course.name}
        </h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(round.date).toLocaleDateString("es-AR")} · SZ {round.enterSzYds}y · Down {round.downInSzStrokes}
        </p>
      </header>

      <StandingsTabs
        individual={standingsBySec}
        pairs={pairsBySec}
      />

      {perfectRuns.length > 0 && (
        <LevelUpCard
          playerId={me.player.id}
          perfectRuns={perfectRuns}
          alreadyApplied={alreadyApplied}
        />
      )}

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
          value={`${kpis.enterSzCount}/${kpis.enterSzDataHoles || "—"}`}
          hint={kpis.enterSzDataHoles > 0 ? `≤ ${round.enterSzYds} yds` : "sin datos cargados"}
        />
        <KPI
          label="Down in SZ"
          value={`${kpis.downInSzCount}/${kpis.downInSzDataHoles || "—"}`}
          hint={kpis.downInSzDataHoles > 0 ? `≤ ${round.downInSzStrokes} golpes` : "sin datos cargados"}
        />
        <KPI
          label="Putts totales"
          value={kpis.totalPutts}
          hint={kpis.puttsDataHoles > 0 ? `${kpis.avgPuttsPerHole.toFixed(1)}/hoyo (${kpis.puttsDataHoles}h)` : "sin datos"}
        />
        <KPI
          label="3-putts"
          value={`${kpis.threePuttsHoles}/${kpis.puttsDataHoles || "—"}`}
          tone={kpis.threePuttsHoles === 0 && kpis.puttsDataHoles > 0 ? "good" : "bad"}
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
        <Link href="/range/pp/nueva" className="gf-btn w-full !py-2 mt-2">
          🎯 Cargar sesión de práctica
        </Link>
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


      {/* Scorecard tabla full — compacto para mostrar todos los jugadores en mobile */}
      <SectionHeader>Scorecard</SectionHeader>
      <Card className="!p-1">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">H</th>
              <th className="text-center p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Par</th>
              {standings.map((s) => {
                const firstName = s.rp.player.name.split(" ")[0];
                return (
                  <th
                    key={s.rp.id}
                    className="text-center p-1 text-[9px] uppercase tracking-wider"
                    style={{ color: s.rp.player.isMe ? "var(--accent)" : "var(--muted)" }}
                  >
                    {firstName}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {round.course.holes.map((h) => (
              <tr key={h.number} className="border-b border-[var(--green-pale)]">
                <td className="p-1 gf-mono">{h.number}</td>
                <td className="p-1 gf-mono text-center text-[var(--muted)]">{h.par}</td>
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
                    <td key={rp.id} className={`p-1 text-center gf-mono ${cls}`}>
                      {score && score > 0 ? score : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="font-bold border-t-2 border-[var(--fairway)]">
              <td className="p-1">T</td>
              <td className="p-1 text-center gf-mono">
                {round.course.holes.reduce((s, h) => s + h.par, 0)}
              </td>
              {standings.map((s) => (
                <td key={s.rp.id} className="p-1 text-center gf-mono">
                  {s.bruto || "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      <DeleteButton roundId={round.id} />
    </div>
  );
}
