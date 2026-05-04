import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import CLUB_LABEL from "@/lib/club-labels";

export const dynamic = "force-dynamic";

const CLUB_ORDER = [
  "DRIVER", "WOOD_3", "WOOD_5", "HYBRID",
  "IRON_3", "IRON_4", "IRON_5", "IRON_6", "IRON_7", "IRON_8", "IRON_9",
  "PW", "GW", "SW", "LW",
];

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sq = nums.reduce((s, n) => s + (n - mean) * (n - mean), 0);
  return Math.sqrt(sq / nums.length);
}

export default async function RangeStatsPage() {
  const sessions = await prisma.rangeSession.findMany({
    orderBy: { date: "asc" },
    include: { shots: true },
  });

  type ShotRow = {
    carry: number | null;
    total: number | null;
    ballSpeed: number | null;
    clubSpeed: number | null;
    smash: number | null;
    spin: number | null;
    aoa: number | null;
    lat: number | null;
  };

  const byClub = new Map<string, {
    sessionDates: Set<string>;
    shots: ShotRow[];
    lastDate: Date | null;
  }>();

  for (const sess of sessions) {
    for (const s of sess.shots) {
      if (s.rowType !== "SHOT") continue;
      if (s.carryYds == null) continue;
      const club = s.club ?? sess.club;
      if (!byClub.has(club)) {
        byClub.set(club, { sessionDates: new Set(), shots: [], lastDate: null });
      }
      const entry = byClub.get(club)!;
      entry.sessionDates.add(sess.id);
      if (!entry.lastDate || sess.date > entry.lastDate) entry.lastDate = sess.date;
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

  const clubStats = Array.from(byClub.entries()).map(([club, entry]) => {
    const carries = entry.shots.map((s) => s.carry).filter((v): v is number => v != null);
    const totals = entry.shots.map((s) => s.total).filter((v): v is number => v != null);
    const balls = entry.shots.map((s) => s.ballSpeed).filter((v): v is number => v != null);
    const clubs = entry.shots.map((s) => s.clubSpeed).filter((v): v is number => v != null);
    const smashes = entry.shots.map((s) => s.smash).filter((v): v is number => v != null);
    const spins = entry.shots.map((s) => s.spin).filter((v): v is number => v != null);
    const aoas = entry.shots.map((s) => s.aoa).filter((v): v is number => v != null);
    const lats = entry.shots.map((s) => s.lat).filter((v): v is number => v != null);

    const carryMean = carries.length > 0 ? carries.reduce((a, b) => a + b, 0) / carries.length : null;
    const carrySd = stdev(carries);
    // Outliers de carry: > 2σ del promedio
    const carryOutliers = carryMean != null && carrySd != null && carrySd > 0
      ? carries.filter((c) => Math.abs(c - carryMean) > 2 * carrySd).length
      : 0;

    return {
      club,
      sessions: entry.sessionDates.size,
      totalShots: entry.shots.length,
      lastDate: entry.lastDate,
      carryMean,
      carryMed: median(carries),
      carryMin: carries.length > 0 ? Math.min(...carries) : null,
      carryMax: carries.length > 0 ? Math.max(...carries) : null,
      carrySd,
      carryOutliers,
      totalMed: median(totals),
      ballMed: median(balls),
      clubMed: median(clubs),
      smashMed: median(smashes),
      spinMed: median(spins),
      aoaMed: median(aoas),
      latMin: lats.length > 0 ? Math.min(...lats) : null,
      latMax: lats.length > 0 ? Math.max(...lats) : null,
      latSd: stdev(lats),
    };
  });

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
          Mediana (M) y rango. Mediana es más representativa cuando hay outliers.
        </p>
      </header>

      {clubStats.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          No hay sesiones FlightScope cargadas todavía
        </Card>
      )}

      {clubStats.map((c) => (
        <Card key={c.club} className="space-y-2">
          <div className="flex justify-between items-baseline border-b border-[var(--green-pale)] pb-2">
            <h2 className="font-bold text-lg text-[var(--fairway)]">
              {CLUB_LABEL[c.club] ?? c.club}
            </h2>
            <span className="text-[10px] text-[var(--muted)] gf-mono">
              {c.totalShots} shots · {c.sessions} ses · {c.lastDate ? new Date(c.lastDate).toLocaleDateString("es-AR") : "—"}
            </span>
          </div>

          {c.carryOutliers > 0 && (
            <div
              className="text-[10px] gf-mono px-2 py-1 rounded"
              style={{ background: "var(--accent)", color: "white" }}
            >
              ⚠ {c.carryOutliers} outlier{c.carryOutliers === 1 ? "" : "s"} (carry &gt; 2σ).
              Considerá borrarlos en la sesión de origen.
            </div>
          )}

          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[var(--muted)] gf-mono">
                <th className="text-left py-1">Métrica</th>
                <th className="text-right">Mediana</th>
                <th className="text-right">Promedio</th>
                <th className="text-right">Min–Max</th>
                <th className="text-right">σ</th>
              </tr>
            </thead>
            <tbody className="gf-mono">
              <tr>
                <td className="py-1 font-semibold">Carry</td>
                <td className="text-right">{c.carryMed?.toFixed(0) ?? "—"}</td>
                <td className="text-right">{c.carryMean?.toFixed(0) ?? "—"}</td>
                <td className="text-right">
                  {c.carryMin?.toFixed(0) ?? "—"}–{c.carryMax?.toFixed(0) ?? "—"}
                </td>
                <td className="text-right">{c.carrySd?.toFixed(0) ?? "—"}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Total</td>
                <td className="text-right">{c.totalMed?.toFixed(0) ?? "—"}</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Ball spd</td>
                <td className="text-right">{c.ballMed?.toFixed(0) ?? "—"} mph</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Club spd</td>
                <td className="text-right">{c.clubMed?.toFixed(0) ?? "—"} mph</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Smash</td>
                <td className="text-right">{c.smashMed?.toFixed(2) ?? "—"}</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Spin</td>
                <td className="text-right">{c.spinMed?.toFixed(0) ?? "—"} rpm</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">AoA</td>
                <td className="text-right">{c.aoaMed?.toFixed(1) ?? "—"}°</td>
                <td className="text-right" colSpan={3}>—</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Lateral</td>
                <td className="text-right">
                  {c.latMin != null && c.latMax != null
                    ? `${c.latMin.toFixed(0)} → ${c.latMax.toFixed(0)}`
                    : "—"}
                </td>
                <td className="text-right" colSpan={2}>
                  σ {c.latSd?.toFixed(0) ?? "—"} yds
                </td>
                <td className="text-right">—</td>
              </tr>
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
