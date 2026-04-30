// Cálculo de ganadores por modalidad de apuesta

import { strokesPerHole, stablefordPoints } from "./handicap";

type CourseHole = { number: number; par: number; hcpHoyo: number };
type PlayerScores = {
  playerId: string;
  name: string;
  isMe: boolean;
  hcp: number;
  scoresByHole: Record<number, number | null>;
};

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

// Devuelve { winnerIds: string[], scores: { playerId, value }[] }
// winnerIds.length puede ser 0 (empate sin ganador) o multiple (empate)
export function computeBetWinner(
  modality: BetModality,
  players: PlayerScores[],
  courseHoles: CourseHole[],
): { winnerIds: string[]; scores: { playerId: string; value: number; display: string }[]; tie: boolean } {
  const holes = holesForModality(courseHoles, modality);

  // Match Play: gana el que más hoyos ganó. Empate si tiene mismo número.
  if (modality.startsWith("MATCH")) {
    const wins: Record<string, number> = {};
    for (const p of players) wins[p.playerId] = 0;

    for (const h of holes) {
      // Calcular net de cada jugador
      const nets = players.map((p) => {
        const score = p.scoresByHole[h.number];
        if (score == null || score === 0) return null;
        const strokes = strokesPerHole(p.hcp, courseHoles)[h.number] ?? 0;
        return { playerId: p.playerId, net: score - strokes };
      }).filter((x): x is { playerId: string; net: number } => x !== null);
      if (nets.length < 2) continue;
      const minNet = Math.min(...nets.map((n) => n.net));
      const winners = nets.filter((n) => n.net === minNet);
      if (winners.length === 1) wins[winners[0].playerId]++;
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
    const strokes = strokesPerHole(p.hcp, courseHoles);
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
