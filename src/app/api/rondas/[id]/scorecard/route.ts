/**
 * POST /api/rondas/[id]/scorecard
 *   Persiste best parts + best shot al Round.
 *   El resto del scorecard se deriva on-the-fly de RoundHole.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Patch = {
  bestParts?: string[];
  bestShot?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roundId } = await params;
  const body = (await req.json()) as Patch;

  const round = await prisma.round.findUnique({ where: { id: roundId }, select: { id: true } });
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const data: Record<string, string | null> = {};
  if (Array.isArray(body.bestParts)) {
    // Filtrar vacíos al guardar; si los 3 están vacíos guardamos null
    const filtered = body.bestParts.filter((s) => s && s.trim() !== "");
    data.bestParts = filtered.length > 0 ? JSON.stringify(filtered) : null;
  }
  if (typeof body.bestShot === "string") {
    data.bestShot = body.bestShot.trim() === "" ? null : body.bestShot;
  }

  const updated = await prisma.round.update({
    where: { id: roundId },
    data,
    select: { id: true, bestParts: true, bestShot: true },
  });

  return NextResponse.json({ ok: true, round: updated });
}
