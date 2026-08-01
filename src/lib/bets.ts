// Cálculo de ganadores por modalidad de apuesta

import { strokesPerHole, stablefordPoints } from "./handicap";

type CourseHole = { number: number; par: number; hcpHoyo: number };
type PlayerScores = {
  playerId: string;
  name: string;
  isMe: boolean;
  hcp: number; // CH default (Medal Total) — usado para Match/Medal stroke allocation
  modalityHcps?: Record<string, number> | null; // CH per modalidad (override por modalidad)
  scoresByHole: Record<number, number | null>;
};

// Devuelve la CH a usar para una modalidad dada del jugador.
// Regla planilla:
//  - Match (cualquier variante) y Stableford usan HCP Stableford
//  - Medal Total usa HCP Medal Total (el default p.hcp)
//  - Medal Ida usa HCP Medal Ida
//  - Medal Vuelta usa HCP Medal Vuelta
function chForModality(p: PlayerScores, mod: BetModality): number {
  // Match (todas las variantes) → HCP de la tabla de la cancha (modalidad MATCH)
  if (mod === "MATCH") return p.modalityHcps?.MATCH ?? p.modalityHcps?.STABLEFORD ?? p.hcp;
  if (mod === "MATCH_IDA") return p.modalityHcps?.MATCH_IDA ?? p.modalityHcps?.MATCH ?? p.hcp;
  if (mod === "MATCH_VUELTA") return p.modalityHcps?.MATCH_VUELTA ?? p.modalityHcps?.MATCH ?? p.hcp;
  // Stableford → HCP Stableford
  if (mod === "STABLEFORD") return p.modalityHcps?.STABLEFORD ?? p.hcp;
  if (mod === "STABLEFORD_IDA") return p.modalityHcps?.STABLEFORD_IDA ?? p.modalityHcps?.STABLEFORD ?? p.hcp;
  if (mod === "STABLEFORD_VUELTA") return p.modalityHcps?.STABLEFORD_VUELTA ?? p.modalityHcps?.STABLEFORD ?? p.hcp;
  // Medal Ida/Vuelta → su propio CH
  if (mod === "MEDAL_IDA") return p.modalityHcps?.MEDAL_IDA ?? p.hcp;
  if (mod === "MEDAL_VUELTA") return p.modalityHcps?.MEDAL_VUELTA ?? p.hcp;
  // Medal Total → Medal CH (el default p.hcp)
  return p.hcp;
}

export type BetModality =
  | "MATCH"
  | "MATCH_IDA"
  | "MATCH_VUELTA"
  | "MEDAL"
  | "MEDAL_IDA"
  | "MEDAL_VUELTA"
  | "STABLEFORD"
  | "STABLEFORD_IDA"
  | "STABLEFORD_VUELTA";

export const MODALITY_LABEL: Record<BetModality, string> = {
  MATCH: "Match Total",
  MATCH_IDA: "Match Ida",
  MATCH_VUELTA: "Match Vuelta",
  MEDAL: "Medal Total",
  MEDAL_IDA: "Medal Ida",
  MEDAL_VUELTA: "Medal Vuelta",
  STABLEFORD: "Stableford",
  STABLEFORD_IDA: "Stableford Ida",
  STABLEFORD_VUELTA: "Stableford Vuelta",
};

function holesForModality(courseHoles: CourseHole[], mod: BetModality): CourseHole[] {
  if (mod.endsWith("_IDA")) return courseHoles.filter((h) => h.number <= 9);
  if (mod.endsWith("_VUELTA")) return courseHoles.filter((h) => h.number >= 10);
  return courseHoles;
}

// Match Play 3 jugadores: 6 pts en juego por hoyo según ranking neto.
//   - 1 gana, 2do, 3ro (todos diferentes) → 4, 2, 0
//   - 2 empatan primero + 1 tercero → 3, 3, 0
//   - 1 gana + 2 empatan segundo → 4, 1, 1
//   - Triple empate → 0, 0, 0
function matchPlay3Players(
  modality: BetModality,
  players: PlayerScores[],
  courseHoles: CourseHole[],
  holes: CourseHole[],
): { winnerIds: string[]; scores: { playerId: string; value: number; display: string }[]; tie: boolean } {
  const totals: Record<string, number> = {};
  for (const p of players) totals[p.playerId] = 0;

  for (const h of holes) {
    const nets = players
      .map((p) => {
        const score = p.scoresByHole[h.number];
        if (score == null || score === 0) return null;
        const ch = chForModality(p, modality);
        const strokes = strokesPerHole(ch, courseHoles)[h.number] ?? 0;
        return { playerId: p.playerId, net: score - strokes };
      })
      .filter((x): x is { playerId: string; net: number } => x !== null);
    if (nets.length < 3) continue;

    const sorted = [...nets].sort((a, b) => a.net - b.net);
    const allEqual = sorted.every((n) => n.net === sorted[0].net);
    if (allEqual) continue;

    const minNet = sorted[0].net;
    const maxNet = sorted[2].net;
    const tiedAtMin = sorted.filter((n) => n.net === minNet).length;

    if (tiedAtMin === 2) {
      // 3, 3, 0
      for (const n of nets) {
        if (n.net === minNet) totals[n.playerId] += 3;
      }
    } else {
      // ganador único: 4, +(2 ó 1,1) según si los 2do y 3ro empatan
      const middleNet = sorted[1].net;
      const middleEqualsMax = middleNet === maxNet;
      for (const n of nets) {
        if (n.net === minNet) totals[n.playerId] += 4;
        else if (middleEqualsMax) totals[n.playerId] += 1; // 4,1,1
        else if (n.net === middleNet) totals[n.playerId] += 2; // 4,2,0
        // 3ro → 0
      }
    }
  }

  const scores = players.map((p) => ({
    playerId: p.playerId,
    value: totals[p.playerId],
    display: `${totals[p.playerId]} pts`,
  }));
  const max = Math.max(...Object.values(totals));
  if (max === 0) return { winnerIds: [], scores, tie: true };
  const winners = Object.keys(totals).filter((id) => totals[id] === max);
  return {
    winnerIds: winners.length === 1 ? winners : [],
    scores,
    tie: winners.length > 1,
  };
}

// Match Play en parejas (4P): por hoyo, 2pts al best ball ganador + 1pt al worst ball ganador.
function matchPlayPairs(
  modality: BetModality,
  players: PlayerScores[],
  courseHoles: CourseHole[],
  holes: CourseHole[],
  pairs: string[][],
): { winnerIds: string[]; scores: { playerId: string; value: number; display: string }[]; tie: boolean } {
  // pairs son arrays de playerId. Acá los IDs son RoundPlayer.id (lo que usamos en playerScoresForBets).
  const [pairA, pairB] = pairs;

  function netForPlayer(playerId: string, holeNum: number): number | null {
    const p = players.find((pp) => pp.playerId === playerId);
    if (!p) return null;
    const score = p.scoresByHole[holeNum];
    if (score == null || score === 0) return null;
    const ch = chForModality(p, modality);
    const strokes = strokesPerHole(ch, courseHoles)[holeNum] ?? 0;
    return score - strokes;
  }

  let ptsA = 0;
  let ptsB = 0;
  for (const h of holes) {
    const netsA = pairA.map((id) => netForPlayer(id, h.number)).filter((n): n is number => n != null);
    const netsB = pairB.map((id) => netForPlayer(id, h.number)).filter((n): n is number => n != null);
    if (netsA.length < 2 || netsB.length < 2) continue;
    const minA = Math.min(...netsA);
    const maxA = Math.max(...netsA);
    const minB = Math.min(...netsB);
    const maxB = Math.max(...netsB);
    if (minA < minB) ptsA += 2;
    else if (minB < minA) ptsB += 2;
    if (maxA < maxB) ptsA += 1;
    else if (maxB < maxA) ptsB += 1;
  }

  // Cada jugador de la pareja "tiene" los pts de la pareja para mostrar
  const scores = players.map((p) => {
    const isA = pairA.includes(p.playerId);
    const isB = pairB.includes(p.playerId);
    const value = isA ? ptsA : isB ? ptsB : 0;
    return {
      playerId: p.playerId,
      value,
      display: `${value} pts${isA ? " (A)" : isB ? " (B)" : ""}`,
    };
  });

  if (ptsA === ptsB) return { winnerIds: [], scores, tie: true };
  const winnerPair = ptsA > ptsB ? pairA : pairB;
  return { winnerIds: winnerPair, scores, tie: false };
}

// Devuelve { winnerIds: string[], scores: { playerId, value }[] }
// winnerIds.length puede ser 0 (empate sin ganador) o multiple (empate)
// pairs: si está seteado, dispara modo "Match Play en parejas" (best ball + worst ball)
export function computeBetWinner(
  modality: BetModality,
  players: PlayerScores[],
  courseHoles: CourseHole[],
  pairs?: string[][],
): { winnerIds: string[]; scores: { playerId: string; value: number; display: string }[]; tie: boolean } {
  const holes = holesForModality(courseHoles, modality);

  // Match Play: gana el que más hoyos / puntos ganó.
  // Pairs: 2pts al BestBall ganador + 1pt al WorstBall ganador (regla de Santi).
  if (modality.startsWith("MATCH")) {
    if (pairs && pairs.length === 2 && pairs[0].length === 2 && pairs[1].length === 2) {
      // Match Play en parejas (4P)
      return matchPlayPairs(modality, players, courseHoles, holes, pairs);
    }
    if (players.length === 3) {
      return matchPlay3Players(modality, players, courseHoles, holes);
    }
    const wins: Record<string, number> = {};
    for (const p of players) wins[p.playerId] = 0;

    if (players.length === 2) {
      // 1v1: diferencia de CH match → golpes solo al de mayor CH
      const [pA, pB] = players;
      const chA = chForModality(pA, modality);
      const chB = chForModality(pB, modality);
      const diff = Math.abs(chA - chB);
      const strokesA = strokesPerHole(chA >= chB ? diff : 0, courseHoles);
      const strokesB = strokesPerHole(chB > chA ? diff : 0, courseHoles);
      for (const h of holes) {
        const scoreA = pA.scoresByHole[h.number];
        const scoreB = pB.scoresByHole[h.number];
        if (scoreA == null || scoreA === 0 || scoreB == null || scoreB === 0) continue;
        const netA = scoreA - (strokesA[h.number] ?? 0);
        const netB = scoreB - (strokesB[h.number] ?? 0);
        if (netA < netB) wins[pA.playerId]++;
        else if (netB < netA) wins[pB.playerId]++;
      }
    } else {
      for (const h of holes) {
        const nets = players
          .map((p) => {
            const score = p.scoresByHole[h.number];
            if (score == null || score === 0) return null;
            const ch = chForModality(p, modality);
            const strokes = strokesPerHole(ch, courseHoles)[h.number] ?? 0;
            return { playerId: p.playerId, net: score - strokes };
          })
          .filter((x): x is { playerId: string; net: number } => x !== null);
        if (nets.length < 2) continue;
        const minNet = Math.min(...nets.map((n) => n.net));
        const winners = nets.filter((n) => n.net === minNet);
        if (winners.length === 1) wins[winners[0].playerId]++;
      }
    }

    const scores = players.map((p) => ({
      playerId: p.playerId,
      value: wins[p.playerId],
      display: `${wins[p.playerId]} hoyos`,
    }));

    const maxWins = Math.max(...Object.values(wins));
    if (maxWins === 0) return { winnerIds: [], scores, tie: true };
    const winners = Object.keys(wins).filter((id) => wins[id] === maxWins);
    return {
      winnerIds: winners.length === 1 ? winners : [],
      scores,
      tie: winners.length > 1,
    };
  }

  // Medal Play: gana el menor neto. Stableford: gana el mayor puntos.
  const isMedal = modality.startsWith("MEDAL");
  const isStbl = modality.startsWith("STABLEFORD");

  const playerScores = players.map((p) => {
    const ch = chForModality(p, modality);
    const strokes = strokesPerHole(ch, courseHoles);
    let total = 0;
    let played = 0;
    for (const h of holes) {
      const s = p.scoresByHole[h.number];
      if (s == null || s === 0) continue;
      played++;
      if (isMedal) total += s - (strokes[h.number] ?? 0);
      else if (isStbl) total += stablefordPoints(h.par, s, strokes[h.number] ?? 0);
    }
    return { playerId: p.playerId, value: total, played };
  });

  // Si hay parejas → Medal/Stableford también se calculan por equipo (suma de los 2)
  if (pairs && pairs.length === 2 && pairs[0].length === 2 && pairs[1].length === 2) {
    const sumForPair = (pair: string[]) => {
      const ps = pair.map((id) => playerScores.find((p) => p.playerId === id));
      if (ps.some((p) => !p || p.played === 0)) return null;
      return ps.reduce((s, p) => s + (p?.value ?? 0), 0);
    };
    const sumA = sumForPair(pairs[0]);
    const sumB = sumForPair(pairs[1]);

    const scoresPair = players.map((p) => {
      const isA = pairs[0].includes(p.playerId);
      const isB = pairs[1].includes(p.playerId);
      const value = isA ? sumA ?? 0 : isB ? sumB ?? 0 : 0;
      const tag = isA ? " (A)" : isB ? " (B)" : "";
      return {
        playerId: p.playerId,
        value,
        display: isMedal ? `${value} neto${tag}` : `${value} pts${tag}`,
      };
    });

    if (sumA == null || sumB == null) {
      return { winnerIds: [], scores: scoresPair, tie: false };
    }
    if (sumA === sumB) return { winnerIds: [], scores: scoresPair, tie: true };
    const winnerPair = isMedal
      ? sumA < sumB ? pairs[0] : pairs[1]
      : sumA > sumB ? pairs[0] : pairs[1];
    return { winnerIds: winnerPair, scores: scoresPair, tie: false };
  }

  const allPlayed = playerScores.every((p) => p.played > 0);

  const scores = playerScores.map((p) => ({
    playerId: p.playerId,
    value: p.value,
    display: isMedal ? `${p.value} neto` : `${p.value} pts`,
  }));

  if (!allPlayed) return { winnerIds: [], scores, tie: false };

  const target = isMedal
    ? Math.min(...playerScores.map((p) => p.value))
    : Math.max(...playerScores.map((p) => p.value));
  const winners = playerScores.filter((p) => p.value === target).map((p) => p.playerId);
  return {
    winnerIds: winners.length === 1 ? winners : [],
    scores,
    tie: winners.length > 1,
  };
}
