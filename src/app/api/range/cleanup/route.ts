import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterClubOutliers } from "@/lib/range-outlier";

// Limpia outliers de TODAS las sesiones existentes (idempotente, conservador).
// Para cada sesión, agrupa shots por club y borra los que caen fuera de
// [median × 0.6, median × 1.6] o con |lateral| > 50 yds.
export async function POST() {
  const sessions = await prisma.rangeSession.findMany({
    include: { shots: true },
  });

  const summary: { sessionId: string; date: string; deletedCount: number; deleted: { club: string; shotNumber: number; reason: string }[] }[] = [];
  let totalDeleted = 0;

  for (const sess of sessions) {
    const byClub = new Map<string, typeof sess.shots>();
    for (const s of sess.shots) {
      const k = s.club ?? sess.club;
      if (!byClub.has(k)) byClub.set(k, []);
      byClub.get(k)!.push(s);
    }

    const toDelete: { club: string; shotNumber: number; id: string; reason: string }[] = [];
    for (const entry of Array.from(byClub.entries())) {
      const [club, group] = entry;
      const r = filterClubOutliers(group);
      for (const d of r.discarded) {
        // d.shot is one of group → tiene .id
        const shot = d.shot as (typeof group)[number];
        toDelete.push({
          club,
          shotNumber: shot.shotNumber,
          id: shot.id,
          reason: d.reason,
        });
      }
    }

    if (toDelete.length > 0) {
      await prisma.rangeShot.deleteMany({
        where: { id: { in: toDelete.map((d) => d.id) } },
      });
      // Invalidar el AI analysis (si existe)
      await prisma.rangeSession.update({
        where: { id: sess.id },
        data: { aiAnalysis: null },
      });
      summary.push({
        sessionId: sess.id,
        date: sess.date.toISOString().slice(0, 10),
        deletedCount: toDelete.length,
        deleted: toDelete.map((d) => ({ club: d.club, shotNumber: d.shotNumber, reason: d.reason })),
      });
      totalDeleted += toDelete.length;
    }
  }

  return NextResponse.json({
    sessionsAffected: summary.length,
    totalDeleted,
    summary,
  });
}
