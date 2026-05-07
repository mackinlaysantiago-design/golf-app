import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const HoleEntrySchema = z.object({
  roundPlayerId: z.string(),
  holeNumber: z.number().int().min(1).max(18),
  strokesToEnterSz: z.number().int().nullable().optional(),
  distanceInRegYds: z.number().int().nullable().optional(),
  strokesInsideSz: z.number().int().nullable().optional(),
  putts: z.number().int().nullable().optional(),
  firstPuttDistanceFt: z.number().int().nullable().optional(),
  puttMadeDistanceFt: z.number().int().nullable().optional(),
  puttsInside1PuttCircle: z.number().int().nullable().optional(),
  score: z.number().int().nullable().optional(),
  penaltyStrokes: z.number().int().nullable().optional(),
  keysBroken: z.array(z.number().int().min(1).max(10)).nullable().optional(),
  targetGoal: z.string().nullable().optional(),
  pinColor: z.enum(["GREEN", "YELLOW", "RED"]).nullable().optional(),
  dangerSide: z.enum(["L", "R", "NONE"]).nullable().optional(),
  aimedAtCenter: z.boolean().nullable().optional(),
  recoveryMode: z.boolean().nullable().optional(),
});

const PutSchema = z.object({
  entries: z.array(HoleEntrySchema).min(1),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PutSchema.parse(body);

  // Validar que todos los roundPlayerIds pertenezcan a esta ronda
  const valid = await prisma.roundPlayer.findMany({
    where: { roundId: id, id: { in: parsed.entries.map((e) => e.roundPlayerId) } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const invalid = parsed.entries.filter((e) => !validIds.has(e.roundPlayerId));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "roundPlayerId no pertenece a esta ronda", invalid },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    parsed.entries.map((e) =>
      prisma.roundHole.upsert({
        where: {
          roundPlayerId_holeNumber: {
            roundPlayerId: e.roundPlayerId,
            holeNumber: e.holeNumber,
          },
        },
        create: {
          roundId: id,
          roundPlayerId: e.roundPlayerId,
          holeNumber: e.holeNumber,
          strokesToEnterSz: e.strokesToEnterSz ?? null,
          distanceInRegYds: e.distanceInRegYds ?? null,
          strokesInsideSz: e.strokesInsideSz ?? null,
          putts: e.putts ?? null,
          firstPuttDistanceFt: e.firstPuttDistanceFt ?? null,
          puttMadeDistanceFt: e.puttMadeDistanceFt ?? null,
          puttsInside1PuttCircle: e.puttsInside1PuttCircle ?? null,
          score: e.score ?? null,
          penaltyStrokes: e.penaltyStrokes ?? null,
          keysBroken: e.keysBroken ?? undefined,
          targetGoal: e.targetGoal ?? null,
          pinColor: e.pinColor ?? null,
          dangerSide: e.dangerSide ?? null,
          aimedAtCenter: e.aimedAtCenter ?? null,
          recoveryMode: e.recoveryMode ?? null,
        },
        update: {
          strokesToEnterSz: e.strokesToEnterSz ?? null,
          distanceInRegYds: e.distanceInRegYds ?? null,
          strokesInsideSz: e.strokesInsideSz ?? null,
          putts: e.putts ?? null,
          firstPuttDistanceFt: e.firstPuttDistanceFt ?? null,
          puttMadeDistanceFt: e.puttMadeDistanceFt ?? null,
          puttsInside1PuttCircle: e.puttsInside1PuttCircle ?? null,
          score: e.score ?? null,
          penaltyStrokes: e.penaltyStrokes ?? null,
          keysBroken: e.keysBroken ?? undefined,
          targetGoal: e.targetGoal ?? null,
          pinColor: e.pinColor ?? null,
          dangerSide: e.dangerSide ?? null,
          aimedAtCenter: e.aimedAtCenter ?? null,
          recoveryMode: e.recoveryMode ?? null,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
