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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

function stdev(nums: number[], mean: number): number {
  if (nums.length < 2) return 0;
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
    smash: number | null;
    spin: number | null;
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
        smash: s.smashFactor,
        spin: s.spinRpm,
        lat,
      });
    }
  }

  type ClubDecision = {
    club: string;
    n: number;
    sessions: number;
    lastDate: Date | null;
    // Distancias para decisión
    safe: number;        // P25 — "casi siempre llegás"
    typical: number;     // mediana — "lo más común"
    good: number;        // P90 — "cuando le pegás bien"
    // Confianza (% shots dentro de ±10 yds de la mediana)
    confidence: number;
    // Dispersión lateral
    latSd: number;
    latP90: number;      // dispersión absoluta del 90% (10 yds más extremo descartado)
    // Otros
    smashMed: number | null;
    spinMed: number | null;
    totalMed: number | null;
  };

  const stats: ClubDecision[] = Array.from(byClub.entries()).map(([club, entry]) => {
    const carries = entry.shots.map((s) => s.carry).filter((v): v is number => v != null);
    const carriesSorted = [...carries].sort((a, b) => a - b);
    const lats = entry.shots.map((s) => s.lat).filter((v): v is number => v != null);
    const totals = entry.shots.map((s) => s.total).filter((v): v is number => v != null);
    const smashes = entry.shots.map((s) => s.smash).filter((v): v is number => v != null);
    const spins = entry.shots.map((s) => s.spin).filter((v): v is number => v != null);

    const med = carriesSorted.length > 0 ? percentile(carriesSorted, 0.5) : 0;
    const insideBand = carries.filter((c) => Math.abs(c - med) <= 10).length;

    return {
      club,
      n: carries.length,
      sessions: entry.sessionDates.size,
      lastDate: entry.lastDate,
      safe: percentile(carriesSorted, 0.25),
      typical: med,
      good: percentile(carriesSorted, 0.9),
      confidence: carries.length > 0 ? (insideBand / carries.length) * 100 : 0,
      latSd: stdev(lats, lats.reduce((a, b) => a + b, 0) / Math.max(lats.length, 1)),
      latP90: lats.length > 0 ? percentile([...lats.map(Math.abs)].sort((a, b) => a - b), 0.9) : 0,
      smashMed: smashes.length > 0 ? median(smashes) : null,
      spinMed: spins.length > 0 ? median(spins) : null,
      totalMed: totals.length > 0 ? median(totals) : null,
    };
  });

  // Sort por orden estándar de palos
  stats.sort((a, b) => {
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
          Distancias para decidir palo en cancha
        </p>
      </header>

      {stats.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          Sin sesiones FlightScope cargadas
        </Card>
      )}

      {/* Tabla compacta para decisión rápida */}
      {stats.length > 0 && (
        <Card className="!p-2 overflow-x-auto">
          <table className="w-full text-[11px] gf-mono">
            <thead>
              <tr className="text-[var(--muted)] uppercase tracking-wider text-[9px]">
                <th className="text-left py-1 pr-2">Palo</th>
                <th className="text-right" title="P25 · llegás casi siempre">Seguro</th>
                <th className="text-right" title="Mediana · lo más común">Típico</th>
                <th className="text-right" title="P90 · cuando le pegás bien">Bueno</th>
                <th className="text-right" title="% shots ±10y de mediana">Conf</th>
                <th className="text-right" title="Dispersión lateral típica">±Lat</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.club} className="border-t border-[var(--green-pale)]">
                  <td className="py-1.5 pr-2 font-semibold">
                    {CLUB_LABEL[s.club] ?? s.club}
                    <span className="text-[9px] text-[var(--muted)] font-normal ml-1">
                      ({s.n})
                    </span>
                  </td>
                  <td className="text-right text-[var(--muted)]">{s.safe.toFixed(0)}</td>
                  <td className="text-right font-bold text-[var(--fairway)]">
                    {s.typical.toFixed(0)}
                  </td>
                  <td className="text-right text-[var(--muted)]">{s.good.toFixed(0)}</td>
                  <td
                    className="text-right"
                    style={{
                      color:
                        s.confidence >= 60
                          ? "var(--green)"
                          : s.confidence >= 40
                          ? "var(--accent)"
                          : "var(--red)",
                    }}
                  >
                    {s.confidence.toFixed(0)}%
                  </td>
                  <td className="text-right text-[var(--muted)]">
                    {s.latP90.toFixed(0)}y
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-[var(--muted)] mt-2 px-1">
            <strong>Seguro</strong>: casi siempre llegás · <strong>Típico</strong>: tu distancia normal · <strong>Bueno</strong>: cuando le pegás bien · <strong>Conf</strong>: % shots cerca de la mediana
          </p>
        </Card>
      )}

      {/* Detalle expandido por palo */}
      {stats.map((s) => (
        <Card key={`detail-${s.club}`} className="space-y-2">
          <div className="flex justify-between items-baseline border-b border-[var(--green-pale)] pb-2">
            <h2 className="font-bold text-lg text-[var(--fairway)]">
              {CLUB_LABEL[s.club] ?? s.club}
            </h2>
            <span className="text-[10px] text-[var(--muted)] gf-mono">
              {s.n} shots · {s.sessions} ses · {s.lastDate ? new Date(s.lastDate).toLocaleDateString("es-AR") : "—"}
            </span>
          </div>

          {/* Visualización tipo barra: safe → typical → good */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--muted)] gf-mono">
              <span>Seguro {s.safe.toFixed(0)}y</span>
              <span className="text-[var(--fairway)] font-bold">
                Típico {s.typical.toFixed(0)}y
              </span>
              <span>Bueno {s.good.toFixed(0)}y</span>
            </div>
            <div className="relative h-3 bg-[var(--green-pale)] rounded-full overflow-hidden">
              {(() => {
                // Mapear [safe, good] a [0, 100]
                const range = Math.max(s.good - s.safe, 1);
                const typicalPct = ((s.typical - s.safe) / range) * 100;
                return (
                  <>
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: 0,
                        width: "100%",
                        background:
                          "linear-gradient(to right, var(--accent) 0%, var(--green) 50%, var(--accent) 100%)",
                        opacity: 0.4,
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-[var(--fairway)]"
                      style={{ left: `${typicalPct}%`, transform: "translateX(-50%)" }}
                    />
                  </>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] gf-mono pt-1">
            <div>
              <div className="text-[9px] text-[var(--muted)] uppercase">Confianza</div>
              <div
                className="font-bold text-base"
                style={{
                  color:
                    s.confidence >= 60
                      ? "var(--green)"
                      : s.confidence >= 40
                      ? "var(--accent)"
                      : "var(--red)",
                }}
              >
                {s.confidence.toFixed(0)}%
              </div>
              <div className="text-[9px] text-[var(--muted)]">±10y de mediana</div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--muted)] uppercase">Disp lateral</div>
              <div className="font-bold text-base">{s.latP90.toFixed(0)}y</div>
              <div className="text-[9px] text-[var(--muted)]">P90 absoluto</div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--muted)] uppercase">Total típico</div>
              <div className="font-bold text-base">
                {s.totalMed != null ? `${s.totalMed.toFixed(0)}y` : "—"}
              </div>
              <div className="text-[9px] text-[var(--muted)]">+roll</div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--muted)] uppercase">Smash</div>
              <div className="font-bold text-base">
                {s.smashMed != null ? s.smashMed.toFixed(2) : "—"}
              </div>
              <div className="text-[9px] text-[var(--muted)]">eficiencia</div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--muted)] uppercase">Spin</div>
              <div className="font-bold text-base">
                {s.spinMed != null ? `${s.spinMed.toFixed(0)}` : "—"}
              </div>
              <div className="text-[9px] text-[var(--muted)]">rpm</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
