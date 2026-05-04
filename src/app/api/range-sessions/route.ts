import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ShotSchema = z.object({
  shotNumber: z.number().int(),
  rowType: z.enum(["SHOT", "AVG", "DEV"]).default("SHOT"),
  club: z.string().nullable().optional(),
  carryYds: z.number().nullable().optional(),
  rollYds: z.number().nullable().optional(),
  totalYds: z.number().nullable().optional(),
  lateralYds: z.number().nullable().optional(),
  lateralDir: z.string().nullable().optional(),
  clubSpeedMph: z.number().nullable().optional(),
  ballSpeedMph: z.number().nullable().optional(),
  spinRpm: z.number().int().nullable().optional(),
  spinAxisDeg: z.number().nullable().optional(),
  spinAxisDir: z.string().nullable().optional(),
  spinLoftDeg: z.number().nullable().optional(),
  smashFactor: z.number().nullable().optional(),
  verticalAngleDeg: z.number().nullable().optional(),
  horizontalAngleDeg: z.number().nullable().optional(),
  horizontalDir: z.string().nullable().optional(),
  aoaDeg: z.number().nullable().optional(),
  heightFt: z.number().nullable().optional(),
  timeSec: z.number().nullable().optional(),
  shotType: z.string().nullable().optional(),
});

const CreateSessionSchema = z.object({
  date: z.string(),
  club: z.string(),
  notes: z.string().nullable().optional(),
  imagePath: z.string().nullable().optional(),
  shots: z.array(ShotSchema).min(1),
});

export async function GET() {
  const sessions = await prisma.rangeSession.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { shots: true } } },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSessionSchema.parse(body);

  // Filtrar outliers POR CLUB antes de guardar
  const { filterClubOutliers } = await import("@/lib/range-outlier");
  const byClub = new Map<string, typeof parsed.shots>();
  for (const s of parsed.shots) {
    const k = s.club ?? parsed.club;
    if (!byClub.has(k)) byClub.set(k, []);
    byClub.get(k)!.push(s);
  }
  const keptShots: typeof parsed.shots = [];
  const discarded: { reason: string; shot: { shotNumber: number; club: string | null | undefined; carryYds?: number | null } }[] = [];
  for (const entry of Array.from(byClub.entries())) {
    const [clubKey, group] = entry;
    const r = filterClubOutliers(group);
    keptShots.push(...r.kept);
    for (const d of r.discarded) {
      discarded.push({
        reason: d.reason,
        shot: { shotNumber: d.shot.shotNumber ?? 0, club: clubKey, carryYds: d.shot.carryYds },
      });
    }
  }

  const session = await prisma.rangeSession.create({
    data: {
      date: new Date(parsed.date),
      club: parsed.club,
      notes: parsed.notes ?? null,
      imagePath: parsed.imagePath ?? null,
      shots: { create: keptShots },
    },
    include: { shots: true },
  });
  return NextResponse.json({ ...session, _filtered: { discardedCount: discarded.length, discarded } }, { status: 201 });
}
