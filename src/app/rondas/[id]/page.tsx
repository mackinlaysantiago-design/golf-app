import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import RondaTracker from "./RondaTracker";

export const dynamic = "force-dynamic";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

const CLUB_ORDER = [
  "DRIVER", "WOOD_3", "WOOD_5", "HYBRID",
  "IRON_3", "IRON_4", "IRON_5", "IRON_6", "IRON_7", "IRON_8", "IRON_9",
  "PW", "GW", "SW", "LW",
  "WEDGE_50", "WEDGE_52", "WEDGE_54", "WEDGE_56", "WEDGE_58", "WEDGE_60",
];

export default async function RondaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [round, rangeSessions] = await Promise.all([
    prisma.round.findUnique({
      where: { id },
      include: {
        course: { include: { holes: { orderBy: { number: "asc" } } } },
        players: {
          orderBy: { position: "asc" },
          include: { player: true, holes: true },
        },
        bets: true,
      },
    }),
    prisma.rangeSession.findMany({
      include: { shots: true },
    }),
  ]);

  if (!round) return notFound();

  // Pre-computar stats por palo (FlightScope) para panel "📊 Palos" en el tracker
  const byClub = new Map<string, { carries: number[]; lats: number[] }>();
  for (const sess of rangeSessions) {
    for (const sh of sess.shots) {
      if (sh.rowType !== "SHOT" || sh.carryYds == null) continue;
      const club = sh.club ?? sess.club;
      if (!byClub.has(club)) byClub.set(club, { carries: [], lats: [] });
      const e = byClub.get(club)!;
      e.carries.push(sh.carryYds);
      if (sh.lateralYds != null) {
        e.lats.push(sh.lateralDir === "L" ? -sh.lateralYds : sh.lateralYds);
      }
    }
  }
  const clubStats = Array.from(byClub.entries())
    .map(([club, v]) => {
      const carriesSorted = [...v.carries].sort((a, b) => a - b);
      const latsSorted = [...v.lats].sort((a, b) => a - b);
      const latMed = latsSorted.length > 0 ? percentile(latsSorted, 0.5) : 0;
      return {
        club,
        n: v.carries.length,
        safe: percentile(carriesSorted, 0.25),
        avg: percentile(carriesSorted, 0.5),
        latDisplay:
          Math.abs(latMed) < 3
            ? "—"
            : `${Math.abs(latMed).toFixed(0)}y ${latMed > 0 ? "R" : "L"}`,
      };
    })
    .sort((a, b) => {
      const ai = CLUB_ORDER.indexOf(a.club);
      const bi = CLUB_ORDER.indexOf(b.club);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return <RondaTracker round={round} clubStats={clubStats} />;
}
