import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Admin: para cada ronda de 9 hoyos, eliminar bets que no apliquen a la sección jugada.
// Mantiene solo {fam}_IDA para nineWhich=IDA y {fam}_VUELTA para nineWhich=VUELTA.
export const dynamic = "force-dynamic";

export async function POST() {
  const rounds = await prisma.round.findMany({
    where: { holesPlayed: 9 },
    select: { id: true, nineWhich: true },
  });
  let deleted = 0;
  for (const r of rounds) {
    if (!r.nineWhich) continue;
    const keep = ["MATCH", "MEDAL", "STABLEFORD"].map(
      (fam) => `${fam}_${r.nineWhich}`,
    );
    const result = await prisma.roundBet.deleteMany({
      where: { roundId: r.id, modality: { notIn: keep } },
    });
    deleted += result.count;
  }
  return NextResponse.json({ ok: true, roundsProcessed: rounds.length, betsDeleted: deleted });
}
