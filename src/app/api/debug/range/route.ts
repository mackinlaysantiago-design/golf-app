import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Diagnóstico de sesiones range — para detectar shots mal taggeados o outliers
export async function GET() {
  const sessions = await prisma.rangeSession.findMany({
    orderBy: { date: "desc" },
    include: { shots: true },
  });

  function median(nums: number[]): number {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  const result = sessions.map((sess) => {
    // Agrupar shots por club efectivo
    const byClub: Record<string, {
      n: number;
      carryAvg: number;
      carryMed: number;
      carryMin: number;
      carryMax: number;
      latAvg: number;
      latMin: number;
      latMax: number;
      smashAvg: number;
      aoaAvg: number;
      sample: { shot: number; carry: number | null; lat: string; aoa: number | null }[];
    }> = {};

    for (const s of sess.shots) {
      if (s.rowType !== "SHOT") continue;
      const club = s.club ?? sess.club;
      if (!byClub[club]) {
        byClub[club] = {
          n: 0, carryAvg: 0, carryMed: 0, carryMin: 0, carryMax: 0,
          latAvg: 0, latMin: 0, latMax: 0, smashAvg: 0, aoaAvg: 0,
          sample: [],
        };
      }
      byClub[club].sample.push({
        shot: s.shotNumber,
        carry: s.carryYds,
        lat: s.lateralYds != null ? `${s.lateralYds}${s.lateralDir ?? ""}` : "—",
        aoa: s.aoaDeg,
      });
    }

    // Compute aggregates
    for (const [club, data] of Object.entries(byClub)) {
      const carries = data.sample.map((x) => x.carry).filter((v): v is number => v != null);
      const lats = data.sample
        .map((x) => {
          if (x.lat === "—") return null;
          const num = parseFloat(x.lat);
          if (isNaN(num)) return null;
          return x.lat.endsWith("L") ? -num : num;
        })
        .filter((v): v is number => v != null);
      const aoas = sess.shots
        .filter((s) => s.rowType === "SHOT" && (s.club ?? sess.club) === club && s.aoaDeg != null)
        .map((s) => s.aoaDeg as number);
      const smashes = sess.shots
        .filter((s) => s.rowType === "SHOT" && (s.club ?? sess.club) === club && s.smashFactor != null)
        .map((s) => s.smashFactor as number);

      data.n = carries.length;
      data.carryAvg = carries.length > 0 ? carries.reduce((a, b) => a + b, 0) / carries.length : 0;
      data.carryMed = median(carries);
      data.carryMin = carries.length > 0 ? Math.min(...carries) : 0;
      data.carryMax = carries.length > 0 ? Math.max(...carries) : 0;
      data.latAvg = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
      data.latMin = lats.length > 0 ? Math.min(...lats) : 0;
      data.latMax = lats.length > 0 ? Math.max(...lats) : 0;
      data.smashAvg = smashes.length > 0 ? smashes.reduce((a, b) => a + b, 0) / smashes.length : 0;
      data.aoaAvg = aoas.length > 0 ? aoas.reduce((a, b) => a + b, 0) / aoas.length : 0;
    }

    return {
      sessionId: sess.id,
      date: sess.date.toISOString().slice(0, 10),
      sessionPrimaryClub: sess.club,
      totalShots: sess.shots.filter((s) => s.rowType === "SHOT").length,
      avgRows: sess.shots.filter((s) => s.rowType === "AVG").length,
      devRows: sess.shots.filter((s) => s.rowType === "DEV").length,
      byClub,
    };
  });

  return NextResponse.json(result);
}
