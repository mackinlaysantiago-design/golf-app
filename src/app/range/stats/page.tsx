import { prisma } from "@/lib/db";
import { Card, KPI } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CLUB_LABEL: Record<string, string> = {
  DRIVER: "Driver",
  WOOD_3: "Madera 3",
  WOOD_5: "Madera 5",
  HYBRID: "Híbrido",
  IRON_3: "Hierro 3",
  IRON_4: "Hierro 4",
  IRON_5: "Hierro 5",
  IRON_6: "Hierro 6",
  IRON_7: "Hierro 7",
  IRON_8: "Hierro 8",
  IRON_9: "Hierro 9",
  PW: "PW",
  GW: "GW",
  SW: "SW",
  LW: "LW",
};

// Orden lógico de palos (driver al fondo, wedges adelante = más a más cerca)
const CLUB_ORDER = [
  "DRIVER", "WOOD_3", "WOOD_5", "HYBRID",
  "IRON_3", "IRON_4", "IRON_5", "IRON_6", "IRON_7", "IRON_8", "IRON_9",
  "PW", "GW", "SW", "LW",
];

export default async function RangeStatsPage() {
  const sessions = await prisma.rangeSession.findMany({
    orderBy: { date: "asc" },
    include: { shots: true },
  });

  type ClubStats = {
    club: string;
    sessions: number;
    totalShots: number;
    lastDate: Date | null;
    avgCarry: number | null;
    bestCarry: number | null;
    avgTotal: number | null;
    avgBallSpeed: number | null;
    avgClubSpeed: number | null;
    avgSmash: number | null;
    avgSpin: number | null;
    avgAoa: number | null;
    avgLateralYds: number | null; // dispersion (range max-min)
    spreadLatYds: number | null;
  };

  const byClub = new Map<string, {
    sessionDates: Set<string>;
    shots: { carry?: number | null; total?: number | null; ballSpeed?: number | null; clubSpeed?: number | null; smash?: number | null; spin?: number | null; aoa?: number | null; lat?: number | null }[];
    lastDate: Date | null;
  }>();

  for (const sess of sessions) {
    if (!byClub.has(sess.club)) {
      byClub.set(sess.club, { sessionDates: new Set(), shots: [], lastDate: null });
    }
    const entry = byClub.get(sess.club)!;
    entry.sessionDates.add(sess.id);
    if (!entry.lastDate || sess.date > entry.lastDate) entry.lastDate = sess.date;
    for (const s of sess.shots) {
      if (s.rowType !== "SHOT") continue;
      if (s.carryYds == null) continue;
      // Lateral firmado: L = neg, R = pos
      const lat = s.lateralYds == null
        ? null
        : s.lateralDir === "L"
        ? -s.lateralYds
        : s.lateralYds;
      entry.shots.push({
        carry: s.carryYds,
        total: s.totalYds,
        ballSpeed: s.ballSpeedMph,
        clubSpeed: s.clubSpeedMph,
        smash: s.smashFactor,
        spin: s.spinRpm,
        aoa: s.aoaDeg,
        lat,
      });
    }
  }

  function avg(nums: (number | null | undefined)[]): number | null {
    const valid = nums.filter((n): n is number => typeof n === "number");
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }
  function maxN(nums: (number | null | undefined)[]): number | null {
    const valid = nums.filter((n): n is number => typeof n === "number");
    if (valid.length === 0) return null;
    return Math.max(...valid);
  }

  const clubStats: ClubStats[] = Array.from(byClub.entries()).map(([club, entry]) => {
    const lats = entry.shots.map((s) => s.lat).filter((n): n is number => typeof n === "number");
    return {
      club,
      sessions: entry.sessionDates.size,
      totalShots: entry.shots.length,
      lastDate: entry.lastDate,
      avgCarry: avg(entry.shots.map((s) => s.carry)),
      bestCarry: maxN(entry.shots.map((s) => s.carry)),
      avgTotal: avg(entry.shots.map((s) => s.total)),
      avgBallSpeed: avg(entry.shots.map((s) => s.ballSpeed)),
      avgClubSpeed: avg(entry.shots.map((s) => s.clubSpeed)),
      avgSmash: avg(entry.shots.map((s) => s.smash)),
      avgSpin: avg(entry.shots.map((s) => s.spin)),
      avgAoa: avg(entry.shots.map((s) => s.aoa)),
      avgLateralYds: avg(lats.map((l) => Math.abs(l))),
      spreadLatYds: lats.length > 0 ? Math.max(...lats) - Math.min(...lats) : null,
    };
  });

  // Sort por orden estándar
  clubStats.sort((a, b) => {
    const ai = CLUB_ORDER.indexOf(a.club);
    const bi = CLUB_ORDER.indexOf(b.club);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range" className="text-xs text-[var(--muted)]">
          ‹ Volver a Range
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          Stats por palo
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Promedios de tus sesiones FlightScope
        </p>
      </header>

      {clubStats.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          No hay sesiones FlightScope cargadas todavía
        </Card>
      )}

      {clubStats.map((c) => (
        <Card key={c.club} className="space-y-3">
          <div className="flex justify-between items-baseline border-b border-[var(--green-pale)] pb-2">
            <h2 className="font-bold text-lg text-[var(--fairway)]">
              {CLUB_LABEL[c.club] ?? c.club}
            </h2>
            <span className="text-[10px] text-[var(--muted)] gf-mono">
              {c.totalShots} shots · {c.sessions} ses · {c.lastDate ? new Date(c.lastDate).toLocaleDateString("es-AR") : "—"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <KPI
              label="Carry"
              value={c.avgCarry != null ? c.avgCarry.toFixed(0) : "—"}
              unit="yds"
              hint={c.bestCarry != null ? `máx ${c.bestCarry.toFixed(0)}` : undefined}
            />
            <KPI
              label="Total"
              value={c.avgTotal != null ? c.avgTotal.toFixed(0) : "—"}
              unit="yds"
            />
            <KPI
              label="Ball spd"
              value={c.avgBallSpeed != null ? c.avgBallSpeed.toFixed(0) : "—"}
              unit="mph"
            />
            <KPI
              label="Club spd"
              value={c.avgClubSpeed != null ? c.avgClubSpeed.toFixed(0) : "—"}
              unit="mph"
            />
            <KPI
              label="Smash"
              value={c.avgSmash != null ? c.avgSmash.toFixed(2) : "—"}
            />
            <KPI
              label="Spin"
              value={c.avgSpin != null ? c.avgSpin.toFixed(0) : "—"}
              unit="rpm"
            />
            <KPI
              label="AoA"
              value={c.avgAoa != null ? c.avgAoa.toFixed(1) : "—"}
              unit="°"
            />
            <KPI
              label="Disp lat"
              value={c.spreadLatYds != null ? c.spreadLatYds.toFixed(1) : "—"}
              unit="yds"
              hint={c.avgLateralYds != null ? `avg |${c.avgLateralYds.toFixed(1)}|` : undefined}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
