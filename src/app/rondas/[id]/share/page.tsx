/**
 * Vista de "compartir resumen" de una ronda.
 *
 * Server-side computa:
 *   - Scorecard (golpes hoyo a hoyo por jugador)
 *   - Apuestas con winners + payouts
 *   - Si FOUR_P: progresión acumulada de puntos por equipo
 *
 * Cliente:
 *   - Snapshot capturable como PNG (html2canvas-pro)
 *   - Botón "Descargar PNG" y "Native Share" (Web Share API en mobile)
 */

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { strokesPerHole, stablefordPoints } from "@/lib/handicap";
import { computeBetWinner, MODALITY_LABEL, type BetModality } from "@/lib/bets";
import ShareClient, { type ShareData } from "./ShareClient";

export const dynamic = "force-dynamic";

export default async function SharePage({
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

  // Detectar 9-hoyos vs 18
  const playedNumbers = new Set(
    round.players[0]?.holes.filter((h) => h.score != null && h.score > 0).map((h) => h.holeNumber) ?? [],
  );
  const hasIdaScores = Array.from(playedNumbers).some((n) => n <= 9);
  const hasVueltaScores = Array.from(playedNumbers).some((n) => n >= 10);
  const autoDetectedNine =
    hasIdaScores && !hasVueltaScores ? "IDA" : hasVueltaScores && !hasIdaScores ? "VUELTA" : null;
  const effectiveNineWhich =
    round.holesPlayed === 9
      ? round.nineWhich === "VUELTA"
        ? "VUELTA"
        : "IDA"
      : autoDetectedNine;
  const isNineOnly = round.holesPlayed === 9 || autoDetectedNine !== null;

  const playableHoles = round.course.holes.filter((h) => {
    if (!isNineOnly) return true;
    return effectiveNineWhich === "VUELTA" ? h.number >= 10 : h.number <= 9;
  });

  // ============ Scorecard (golpes por hoyo) ============
  const scorecard = {
    holes: playableHoles.map((h) => ({
      number: h.number,
      par: h.par,
      hcpHoyo: h.hcpHoyo,
    })),
    players: round.players.map((rp) => ({
      id: rp.id,
      name: rp.player.name,
      hcpIndex: rp.hcpIndex ?? null,
      isMe: rp.player.isMe,
      scoresByHole: Object.fromEntries(
        rp.holes
          .filter((h) => h.score != null && h.score > 0)
          .map((h) => [h.holeNumber, h.score!]),
      ) as Record<number, number>,
    })),
  };

  // ============ Apuestas (winners + payouts) ============
  const playerScoresForBets = round.players.map((rp) => {
    const scoresByHole: Record<number, number | null> = {};
    for (const h of round.course.holes) {
      const hd = rp.holes.find((rh) => rh.holeNumber === h.number);
      scoresByHole[h.number] = hd?.score ?? null;
    }
    return {
      playerId: rp.id,
      name: rp.player.name,
      isMe: rp.player.isMe,
      hcp: rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0),
      modalityHcps: (rp.modalityHcps as Record<string, number> | null) ?? null,
      scoresByHole,
    };
  });

  const courseHolesFull = round.course.holes.map((h) => ({
    number: h.number,
    par: h.par,
    hcpHoyo: h.hcpHoyo,
  }));
  // IMPORTANTE: round.pairs guarda Player.id en DB pero computeBetWinner
  // espera RoundPlayer.id (que es lo que usa playerScoresForBets).
  // Sin esta traducción, computeBetWinner no encuentra los players de la
  // pareja → "sin definir" en TODOS los juegos.
  const pairsArr: string[][] | undefined =
    round.mode === "FOUR_P" && round.pairs
      ? (() => {
          try {
            const raw: string[][] = JSON.parse(round.pairs!);
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

  const betResults = round.bets
    .map((b) => {
      const result = computeBetWinner(
        b.modality as BetModality,
        playerScoresForBets,
        courseHolesFull,
        pairsArr,
      );
      const winnerNames = result.winnerIds.map(
        (id) => round.players.find((rp) => rp.id === id)?.player.name ?? id,
      );
      const amount = b.amount;
      const totalPot = amount * (round.players.length - 1);
      return {
        modality: b.modality,
        label: MODALITY_LABEL[b.modality as BetModality] ?? b.modality,
        amount,
        winnerNames,
        tie: result.tie,
        totalPot,
        scoresDisplay: result.scores.map((s) => ({
          name: round.players.find((rp) => rp.id === s.playerId)?.player.name ?? s.playerId,
          display: s.display,
          isMe: round.players.find((rp) => rp.id === s.playerId)?.player.isMe ?? false,
        })),
      };
    })
    .filter((b) => b.scoresDisplay.length > 0);

  // ============ FOUR_P: progresión acumulada de puntos hoyo a hoyo ============
  let pairsProgression: ShareData["pairsProgression"] = null;
  if (round.mode === "FOUR_P" && round.pairs) {
    try {
      const pairsJSON = JSON.parse(round.pairs) as string[][];
      if (pairsJSON.length === 2) {
        const rpByPlayerId = new Map(round.players.map((rp) => [rp.player.id, rp]));
        const pairAR = pairsJSON[0]
          .map((pid) => rpByPlayerId.get(pid))
          .filter((x): x is NonNullable<typeof x> => Boolean(x));
        const pairBR = pairsJSON[1]
          .map((pid) => rpByPlayerId.get(pid))
          .filter((x): x is NonNullable<typeof x> => Boolean(x));
        if (pairAR.length === 2 && pairBR.length === 2) {
          // Progresión: por hoyo, calcular match points BB+WB y acumulado
          const netFor = (rp: typeof pairAR[number], holeNum: number) => {
            const hd = rp.holes.find((rh) => rh.holeNumber === holeNum);
            if (!hd?.score) return null;
            const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
            const ch = mh?.STABLEFORD ?? rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
            const strokes = strokesPerHole(ch, courseHolesFull)[holeNum] ?? 0;
            return hd.score - strokes;
          };
          const stblFor = (rp: typeof pairAR[number], holeNum: number, par: number) => {
            const hd = rp.holes.find((rh) => rh.holeNumber === holeNum);
            if (!hd?.score) return 0;
            const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
            const ch = mh?.STABLEFORD ?? rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
            const strokes = strokesPerHole(ch, courseHolesFull)[holeNum] ?? 0;
            return stablefordPoints(par, hd.score, strokes);
          };

          let cumA = 0,
            cumB = 0,
            cumStblA = 0,
            cumStblB = 0;
          const progression = playableHoles.map((h) => {
            const netsA = pairAR.map((rp) => netFor(rp, h.number)).filter((n): n is number => n != null);
            const netsB = pairBR.map((rp) => netFor(rp, h.number)).filter((n): n is number => n != null);
            let ptsA = 0,
              ptsB = 0;
            if (netsA.length === 2 && netsB.length === 2) {
              const minA = Math.min(...netsA),
                maxA = Math.max(...netsA);
              const minB = Math.min(...netsB),
                maxB = Math.max(...netsB);
              if (minA < minB) ptsA += 2;
              else if (minB < minA) ptsB += 2;
              if (maxA < maxB) ptsA += 1;
              else if (maxB < maxA) ptsB += 1;
            }
            cumA += ptsA;
            cumB += ptsB;
            const stblA = pairAR.reduce((s, rp) => s + stblFor(rp, h.number, h.par), 0);
            const stblB = pairBR.reduce((s, rp) => s + stblFor(rp, h.number, h.par), 0);
            cumStblA += stblA;
            cumStblB += stblB;
            return {
              holeNumber: h.number,
              par: h.par,
              ptsA,
              ptsB,
              cumA,
              cumB,
              stblA,
              stblB,
              cumStblA,
              cumStblB,
            };
          });

          pairsProgression = {
            pairAName: pairAR.map((rp) => rp.player.name).join(" & "),
            pairBName: pairBR.map((rp) => rp.player.name).join(" & "),
            holes: progression,
            finalMatchA: cumA,
            finalMatchB: cumB,
            finalStblA: cumStblA,
            finalStblB: cumStblB,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  const data: ShareData = {
    roundId: round.id,
    courseName: round.course.name,
    date: round.date.toISOString(),
    modality: round.modality,
    mode: round.mode,
    holesPlayed: round.holesPlayed,
    nineWhich: effectiveNineWhich ?? null,
    scorecard,
    betResults,
    pairsProgression,
  };

  return <ShareClient data={data} />;
}
