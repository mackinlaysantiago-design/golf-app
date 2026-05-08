import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Stats agregadas por palo desde RangeShot. Considera el override `shot.club` si existe,
// sino el club de la sesión. Solo rowType=SHOT (descarta filas AVG/DEV).
export const dynamic = "force-dynamic";

export async function GET() {
  const shots = await prisma.rangeShot.findMany({
    where: { rowType: "SHOT" },
    include: { session: { select: { club: true, date: true } } },
  });

  type Bucket = {
    club: string;
    totals: number[];
    laterals: number[]; // signed: L = negativo, R = positivo
    lastDate: Date | null;
  };
  const buckets = new Map<string, Bucket>();

  for (const s of shots) {
    const club = s.club || s.session.club;
    if (!club) continue;
    if (s.totalYds == null) continue;
    let b = buckets.get(club);
    if (!b) {
      b = { club, totals: [], laterals: [], lastDate: null };
      buckets.set(club, b);
    }
    b.totals.push(s.totalYds);
    if (s.lateralYds != null) {
      const sign = s.lateralDir === "L" ? -1 : 1;
      b.laterals.push(sign * s.lateralYds);
    }
    if (!b.lastDate || s.session.date > b.lastDate) {
      b.lastDate = s.session.date;
    }
  }

  function stats(arr: number[]) {
    if (arr.length === 0) return { mean: 0, std: 0 };
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return { mean, std: Math.sqrt(variance) };
  }

  const out = Array.from(buckets.values())
    .map((b) => {
      const total = stats(b.totals);
      const lateral = stats(b.laterals);
      return {
        club: b.club,
        count: b.totals.length,
        meanTotal: round1(total.mean),
        stdTotal: round1(total.std),
        meanLateral: round1(lateral.mean),
        stdLateral: round1(lateral.std),
        lastDate: b.lastDate,
      };
    })
    .sort((a, b) => b.meanTotal - a.meanTotal);

  return NextResponse.json(out);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
