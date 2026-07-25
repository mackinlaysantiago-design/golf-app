import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DRILLS, bestHistoricalScore } from "@/lib/pp-drills";

// Pega a la DB → no prerenderizar en build (si no, falla el deploy).
export const dynamic = "force-dynamic";

// Devuelve la mejor marca histórica de cada drill type
export async function GET() {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "desc" },
    include: { drills: true },
  });

  const result: Record<string, { best: number | null; lastDate: string | null }> = {};
  for (const drill of DRILLS) {
    const allAttempts: number[][] = [];
    let lastDate: Date | null = null;
    for (const s of sessions) {
      for (const d of s.drills) {
        if (d.drillType !== drill.type) continue;
        const attempts = (d.attemptsJson as number[]) ?? [];
        if (attempts.length > 0) {
          allAttempts.push(attempts);
          if (!lastDate || s.date > lastDate) lastDate = s.date;
        }
      }
    }
    result[drill.type] = {
      best: bestHistoricalScore(drill, allAttempts),
      lastDate: lastDate ? lastDate.toISOString() : null,
    };
  }
  return NextResponse.json(result);
}
