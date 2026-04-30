import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ShotSchema = z.object({
  shotNumber: z.number().int(),
  rowType: z.enum(["SHOT", "AVG", "DEV"]).default("SHOT"),
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

  const session = await prisma.rangeSession.create({
    data: {
      date: new Date(parsed.date),
      club: parsed.club,
      notes: parsed.notes ?? null,
      imagePath: parsed.imagePath ?? null,
      shots: { create: parsed.shots },
    },
    include: { shots: true },
  });
  return NextResponse.json(session, { status: 201 });
}
