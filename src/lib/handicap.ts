// Handicap math — golpes de ventaja por hoyo + Match/Medal/Stableford

export type PlayerHcp = {
  playerId: string;
  name: string;
  hcpIndex: number; // course handicap (entero)
};

export type CourseHoleHcp = {
  number: number; // 1..18
  par: number;
  hcpHoyo: number; // 1..18
};

// Course Handicap de ida/vuelta a partir del CH total (18 hoyos).
// Las tablas de club (ej Golfistics) traen columnas separadas para ida/vuelta
// pero son una guía redondeada, no la fórmula oficial: con índices finos (ej
// 13.8) pueden dar un split erróneo (6/6 en vez de 5/6). La regla correcta,
// confirmada con Ale Massa (AAG) el 19/09/2026: CH total ÷ 2, y si es impar
// el golpe extra va a la IDA — porque el hoyo hcp 1 (el más difícil) siempre
// es impar y cae en la ida, nunca en la vuelta.
export function splitCourseHcpIdaVuelta(courseHcpTotal: number): {
  ida: number;
  vuelta: number;
} {
  return {
    ida: Math.ceil(courseHcpTotal / 2),
    vuelta: Math.floor(courseHcpTotal / 2),
  };
}

// Devuelve un map de holeNumber → golpes de ventaja para un jugador.
// Reglas:
//  - Si HCP del jugador <= 18: recibe 1 golpe en los hoyos con hcpHoyo <= HCP.
//  - Si HCP > 18: recibe 1 golpe en todos + 1 extra en los con hcpHoyo <= (HCP - 18).
//  - Si HCP < 0 (plus): da golpes (negativo) — implementación simple: -1 en los hoyos con hcpHoyo >= 18 + HCP + 1
export function strokesPerHole(
  hcp: number,
  courseHoles: CourseHoleHcp[],
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const h of courseHoles) result[h.number] = 0;

  if (hcp === 0 || isNaN(hcp)) return result;

  const n = courseHoles.length;
  // Rankear por dificultad DENTRO del set de hoyos recibido (1..n), no comparar
  // el hcpHoyo crudo de la cancha. Para los 18 hoyos completos da lo mismo (el
  // hcpHoyo ya es una permutación de 1..18, así que rank === hcpHoyo), pero para
  // una sola vuelta de 9 el hcpHoyo salta de a 2 (impares en la ida, pares en la
  // vuelta) — comparar un CH de 9 hoyos contra esos valores crudos le daba la
  // mitad de los golpes de ventaja que le correspondían.
  const ranked = [...courseHoles].sort((a, b) => a.hcpHoyo - b.hcpHoyo);
  const rankByNumber = new Map(ranked.map((h, i) => [h.number, i + 1]));

  if (hcp > 0) {
    const base = Math.floor(hcp / n);
    const extra = hcp % n;
    for (const h of courseHoles) {
      const rank = rankByNumber.get(h.number)!;
      result[h.number] = base + (rank <= extra ? 1 : 0);
    }
  } else {
    // plus handicap (jugador da golpes)
    const give = Math.abs(hcp);
    for (const h of courseHoles) {
      const rank = rankByNumber.get(h.number)!;
      result[h.number] = rank > n - give ? -1 : 0;
    }
  }

  return result;
}

// Calcula puntos Stableford por hoyo
//  - Net score = bruto - golpes ventaja
//  - vs par: -2 (eagle neto) = 4 pts, -1 = 3, par = 2, +1 = 1, +2 o peor = 0
export function stablefordPoints(
  par: number,
  brutoScore: number,
  strokesReceived: number,
): number {
  const net = brutoScore - strokesReceived;
  const vsPar = net - par;
  if (vsPar <= -2) return 4;
  if (vsPar === -1) return 3;
  if (vsPar === 0) return 2;
  if (vsPar === 1) return 1;
  return 0;
}

// Match Play — para 2 jugadores. Retorna +1 si A gana hoyo, -1 si B, 0 empate.
export function matchPlayHole(
  scoreA: number | null,
  scoreB: number | null,
  strokesA: number,
  strokesB: number,
): -1 | 0 | 1 | null {
  if (scoreA == null || scoreB == null) return null;
  const netA = scoreA - strokesA;
  const netB = scoreB - strokesB;
  if (netA < netB) return 1;
  if (netA > netB) return -1;
  return 0;
}

export type PlayerRoundSummary = {
  playerId: string;
  name: string;
  hcp: number;
  scores: (number | null)[]; // 18 hoyos
  strokesReceived: number[]; // 18 hoyos
  bruto: number;
  neto: number;
  stableford: number;
  brutoIda: number;
  brutoVuelta: number;
};

export function summarizePlayer(
  player: PlayerHcp,
  courseHoles: CourseHoleHcp[],
  scoresByHole: Record<number, number | null>,
): PlayerRoundSummary {
  const strokes = strokesPerHole(player.hcpIndex, courseHoles);
  const scores: (number | null)[] = [];
  const strokesReceived: number[] = [];
  let bruto = 0;
  let neto = 0;
  let stableford = 0;
  let brutoIda = 0;
  let brutoVuelta = 0;

  for (const h of courseHoles) {
    const s = scoresByHole[h.number] ?? null;
    scores.push(s);
    const sr = strokes[h.number] ?? 0;
    strokesReceived.push(sr);
    if (s != null && s > 0) {
      bruto += s;
      neto += s - sr;
      stableford += stablefordPoints(h.par, s, sr);
      if (h.number <= 9) brutoIda += s;
      else brutoVuelta += s;
    }
  }

  return {
    playerId: player.playerId,
    name: player.name,
    hcp: player.hcpIndex,
    scores,
    strokesReceived,
    bruto,
    neto,
    stableford,
    brutoIda,
    brutoVuelta,
  };
}

