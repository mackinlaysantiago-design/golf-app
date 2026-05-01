import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const DrillSchema = z.object({
  drillType: z.string(),
  distance: z.number().int().nullable().optional(),
  attempts: z.number().int().nullable().optional(),
  successes: z.number().int().nullable().optional(),
  bestScore: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const CreateSessionSchema = z.object({
  date: z.string(),
  notes: z.string().nullable().optional(),
  drills: z.array(DrillSchema),
});

export async function GET() {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "desc" },
    include: { drills: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSessionSchema.parse(body);
  const session = await prisma.practiceSession.create({
    data: {
      date: new Date(parsed.date),
      notes: parsed.notes ?? null,
      drills: { create: parsed.drills },
    },
    include: { drills: true },
  });
  return NextResponse.json(session, { status: 201 });
}
