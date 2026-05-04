import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Repara rondas 4P cuyo `pairs` JSON contiene playerIds que ya no existen
// (típicamente porque fusionamos jugadores y el ID viejo quedó huérfano).
//
// Heurística: para cada ronda con pairs, comparamos los playerIds del JSON
// contra los playerIds reales de RoundPlayer. Si hay 1 missing y 1 extra,
// asumimos que el extra reemplaza al missing y reescribimos el pairs JSON.
// Si hay >1 mismatch, dejamos la ronda sin tocar y la incluimos en `unfixable`.
export async function POST() {
  const rounds = await prisma.round.findMany({
    where: { mode: "FOUR_P", pairs: { not: null } },
    include: { players: true },
  });

  const fixed: { roundId: string; date: string; replaced: { from: string; to: string }[] }[] = [];
  const ok: string[] = [];
  const unfixable: { roundId: string; date: string; missing: string[]; extra: string[] }[] = [];

  for (const round of rounds) {
    let pairsJSON: string[][];
    try {
      pairsJSON = JSON.parse(round.pairs!);
    } catch {
      continue;
    }
    const pairsIds = Array.from(new Set(pairsJSON.flat()));
    const realIds = Array.from(new Set(round.players.map((rp) => rp.playerId)));

    const missing = pairsIds.filter((id) => !realIds.includes(id));
    const extra = realIds.filter((id) => !pairsIds.includes(id));

    if (missing.length === 0) {
      ok.push(round.id);
      continue;
    }

    if (missing.length === extra.length && missing.length === 1) {
      // 1-a-1 reemplazo
      const replaced = [{ from: missing[0], to: extra[0] }];
      const newPairs = pairsJSON.map((pair) =>
        pair.map((pid) => (pid === missing[0] ? extra[0] : pid)),
      );
      await prisma.round.update({
        where: { id: round.id },
        data: { pairs: JSON.stringify(newPairs) },
      });
      fixed.push({ roundId: round.id, date: round.date.toISOString(), replaced });
    } else if (missing.length > 0 && extra.length === missing.length) {
      // Misma cantidad pero >1 — no podemos asumir mapping
      unfixable.push({
        roundId: round.id,
        date: round.date.toISOString(),
        missing,
        extra,
      });
    } else {
      // Mismatch raro (más missings que extras o viceversa)
      unfixable.push({
        roundId: round.id,
        date: round.date.toISOString(),
        missing,
        extra,
      });
    }
  }

  return NextResponse.json({
    rounds: rounds.length,
    okCount: ok.length,
    fixedCount: fixed.length,
    unfixableCount: unfixable.length,
    fixed,
    unfixable,
  });
}
