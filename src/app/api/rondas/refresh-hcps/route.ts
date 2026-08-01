import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MODALITIES = ["MEDAL", "MEDAL_IDA", "MEDAL_VUELTA", "STABLEFORD", "STABLEFORD_IDA", "STABLEFORD_VUELTA", "MATCH", "MATCH_IDA", "MATCH_VUELTA"];

// POST: para cada RoundPlayer existente, recompute modalityHcps via lookup en CourseHcpRange
// Útil para rondas creadas antes de la feature, o cuando los HCPs cambiaron y hay que actualizar.
export async function POST() {
  const rounds = await prisma.round.findMany({
    include: { players: true },
  });

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const round of rounds) {
    for (const rp of round.players) {
      try {
        if (rp.hcpIndex == null) {
          skipped++;
          continue;
        }
        const chs: Record<string, number> = {};
        for (const mod of MODALITIES) {
          const range = await prisma.courseHcpRange.findFirst({
            where: {
              courseId: round.courseId,
              modality: mod,
              tee: round.tee,
              indexFrom: { lte: rp.hcpIndex },
              indexTo: { gte: rp.hcpIndex },
            },
          });
          if (range) chs[mod] = range.courseHcp;
        }
        if (Object.keys(chs).length === 0) {
          skipped++;
          continue;
        }
        await prisma.roundPlayer.update({
          where: { id: rp.id },
          data: {
            modalityHcps: chs,
            // También actualizar courseHcp con Medal Total
            courseHcp: chs.MEDAL ?? rp.courseHcp,
          },
        });
        updated++;
      } catch (e) {
        errors.push(`${round.id}/${rp.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return NextResponse.json({ rounds: rounds.length, updated, skipped, errors });
}
