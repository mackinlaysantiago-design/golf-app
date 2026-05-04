import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
  targetId: z.string().min(1),
});

// Fusiona el jugador `id` (source) en el jugador `targetId` (target):
// - mueve todos los RoundPlayer del source al target (si chocan en (roundId, playerId), se descartan los del source)
// - si source.isMe = true, target hereda isMe
// - borra source
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params;
  const body = await req.json();
  const { targetId } = Body.parse(body);

  if (sourceId === targetId) {
    return NextResponse.json({ error: "no podés fusionar a un jugador consigo mismo" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.player.findUnique({ where: { id: sourceId } }),
    prisma.player.findUnique({ where: { id: targetId } }),
  ]);
  if (!source) return NextResponse.json({ error: "source no existe" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "target no existe" }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    // Encontrar conflictos: rondas donde target ya está como jugador
    const targetRounds = new Set(
      (await tx.roundPlayer.findMany({
        where: { playerId: targetId },
        select: { roundId: true },
      })).map((r) => r.roundId),
    );

    const sourceRPs = await tx.roundPlayer.findMany({
      where: { playerId: sourceId },
      select: { id: true, roundId: true },
    });

    const conflictingIds = sourceRPs
      .filter((rp) => targetRounds.has(rp.roundId))
      .map((rp) => rp.id);
    const movableIds = sourceRPs
      .filter((rp) => !targetRounds.has(rp.roundId))
      .map((rp) => rp.id);

    // Conflicts: borrar (target ya está en esa ronda, source es el duplicado)
    if (conflictingIds.length > 0) {
      await tx.roundPlayer.deleteMany({ where: { id: { in: conflictingIds } } });
    }

    // Move: re-asignar al target
    if (movableIds.length > 0) {
      await tx.roundPlayer.updateMany({
        where: { id: { in: movableIds } },
        data: { playerId: targetId },
      });
    }

    // isMe: si source es yo y target no, target hereda
    if (source.isMe && !target.isMe) {
      await tx.player.update({ where: { id: targetId }, data: { isMe: true } });
    }

    // hcpIndex: si target no tiene index pero source sí, copiarlo
    if (target.hcpIndex == null && source.hcpIndex != null) {
      await tx.player.update({
        where: { id: targetId },
        data: { hcpIndex: source.hcpIndex, lastHcpUpdate: source.lastHcpUpdate },
      });
    }

    // lucilaMatricula: si target no tiene y source sí, copiar
    if (!target.lucilaMatricula && source.lucilaMatricula) {
      await tx.player.update({
        where: { id: targetId },
        data: { lucilaMatricula: source.lucilaMatricula },
      });
    }

    // Actualizar `pairs` JSON en rondas 4P: reemplazar sourceId por targetId
    const roundsWithPairs = await tx.round.findMany({
      where: { mode: "FOUR_P", pairs: { not: null } },
      select: { id: true, pairs: true },
    });
    let pairsUpdated = 0;
    for (const r of roundsWithPairs) {
      try {
        const parsed: string[][] = JSON.parse(r.pairs!);
        if (!parsed.flat().includes(sourceId)) continue;
        const replaced = parsed.map((pair) =>
          pair.map((pid) => (pid === sourceId ? targetId : pid)),
        );
        await tx.round.update({
          where: { id: r.id },
          data: { pairs: JSON.stringify(replaced) },
        });
        pairsUpdated++;
      } catch {
        // pairs JSON inválido — skip
      }
    }

    // Borrar source
    await tx.player.delete({ where: { id: sourceId } });

    return {
      moved: movableIds.length,
      conflicts: conflictingIds.length,
      pairsUpdated,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
