import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  DRILL_BY_TYPE,
  bestHistoricalScore,
  meetsTarget,
  type DrillType,
} from "@/lib/pp-drills";

const DrillSchema = z.object({
  drillType: z.string(),
  distance: z.number().int().nullable().optional(),
  club: z.string().nullable().optional(),
  ppCode: z.string().nullable().optional(),
  attempts: z.array(z.number()).default([]),
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

  // Para cada drill, computar si "subió de nivel" comparando con marca anterior
  const pastSessions = await prisma.practiceSession.findMany({
    include: { drills: true },
  });

  const drillsToCreate = parsed.drills.map((d) => {
    const def = DRILL_BY_TYPE[d.drillType as DrillType];
    if (!def) {
      return {
        drillType: d.drillType,
        distance: d.distance ?? null,
        club: d.club ?? null,
        ppCode: d.ppCode ?? null,
        target: null,
        attemptsJson: d.attempts ?? [],
        leveledUp: false,
        notes: d.notes ?? null,
      };
    }

    // Past attempts AT same distance/club
    const past = pastSessions.flatMap((s) =>
      s.drills
        .filter((dr) => {
          if (dr.drillType !== d.drillType) return false;
          if (def.type === "GO_TO_CLUB") return dr.club === d.club;
          if (def.distanceStep) return dr.distance === d.distance;
          return true;
        })
        .map((dr) => (dr.attemptsJson as number[]) ?? []),
    );
    const bestPrevious = bestHistoricalScore(def, past);
    const leveledUp = meetsTarget(def, d.attempts, bestPrevious);

    return {
      drillType: d.drillType,
      distance: d.distance ?? null,
      club: d.club ?? null,
      ppCode: d.ppCode ?? null,
      target: bestPrevious,
      attemptsJson: d.attempts ?? [],
      leveledUp,
      notes: d.notes ?? null,
    };
  });

  const session = await prisma.practiceSession.create({
    data: {
      date: new Date(parsed.date),
      notes: parsed.notes ?? null,
      drills: { create: drillsToCreate },
    },
    include: { drills: true },
  });
  return NextResponse.json(session, { status: 201 });
}
