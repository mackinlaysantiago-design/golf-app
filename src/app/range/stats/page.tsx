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

// Texto natural para la dispersión: "10 yds a la derecha", "5 yds a la izquierda", "centrado"
function aimText(latMed: number, pctRight: number): { dir: "L" | "R" | "C"; magnitude: number; label: string; aim: string } {
  const abs = Math.abs(latMed);
  if (abs < 3) return { dir: "C", magnitude: 0, label: "centrado", aim: "Apuntá al target" };
  const dir = latMed > 0 ? "R" : "L";
  const sideName = dir === "R" ? "derecha" : "izquierda";
  const oppSide = dir === "R" ? "izquierda" : "derecha";
  const dominance = dir === "R" ? pctRight : 100 - pctRight;
  return {
    dir,
    magnitude: abs,
    label: `${abs.toFixed(0)}y a la ${sideName}`,
    aim: `Apuntá ${abs.toFixed(0)}y a la ${oppSide}${dominance >= 70 ? "" : ` (${dominance.toFixed(0)}% de las veces)`}`,
  };
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
    latMed: number;      // mediana firmada (+ = derecha, − = izquierda)
    pctRight: number;    // % shots a la derecha del target
    latSpread: number;   // ±yds típicos del eje (P90 absoluto desde la mediana)
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

    // Dirección típica de la dispersión
    const latSorted = [...lats].sort((a, b) => a - b);
    const latMed = lats.length > 0 ? percentile(latSorted, 0.5) : 0;
    const rightCount = lats.filter((l) => l > 0).length;
    const pctRight = lats.length > 0 ? (rightCount / lats.length) * 100 : 50;
    // Spread alrededor de la mediana lateral (no del 0)
    const offsetsFromMed = lats.map((l) => Math.abs(l - latMed)).sort((a, b) => a - b);
    const latSpread = offsetsFromMed.length > 0 ? percentile(offsetsFromMed, 0.9) : 0;

    return {
      club,
      n: carries.length,
      sessions: entry.sessionDates.size,
      lastDate: entry.lastDate,
      safe: percentile(carriesSorted, 0.25),
      typical: med,
      good: percentile(carriesSorted, 0.9),
      confidence: carries.length > 0 ? (insideBand / carries.length) * 100 : 0,
      latMed,
      pctRight,
      latSpread,
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
                <th className="text-right" title="Para dónde sale en promedio">Suele ir</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const aim = aimText(s.latMed, s.pctRight);
                return (
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
                    <td
                      className="text-right"
                      style={{
                        color:
                          aim.dir === "C"
                            ? "var(--green)"
                            : "var(--accent)",
                      }}
                    >
                      {aim.dir === "C" ? "—" : `${aim.dir} ${aim.magnitude.toFixed(0)}y`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-[var(--muted)] mt-2 px-1">
            <strong>Seguro</strong>: casi siempre llegás · <strong>Típico</strong>: tu distancia normal · <strong>Bueno</strong>: cuando le pegás bien · <strong>Conf</strong>: repetibilidad · <strong>Suele ir</strong>: si dice <strong>R 10y</strong>, apuntá 10y a la izquierda
          </p>
        </Card>
      )}

      {/* Detalle expandido por palo */}
      {stats.map((s) => {
        const aim = aimText(s.latMed, s.pctRight);
        return (
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

          {/* Aim card destacada */}
          <div
            className="rounded-lg p-2 text-center"
            style={{
              background: aim.dir === "C" ? "var(--green-pale)" : "var(--accent)",
              color: aim.dir === "C" ? "var(--fairway)" : "white",
            }}
          >
            <div className="text-[9px] uppercase tracking-wider opacity-80">
              Suele caer
            </div>
            <div className="text-lg font-bold gf-display">{aim.label}</div>
            <div className="text-[10px] opacity-90 mt-0.5">{aim.aim}</div>
            {aim.dir !== "C" && (
              <div className="text-[9px] opacity-70 mt-0.5 gf-mono">
                {s.pctRight.toFixed(0)}% R · {(100 - s.pctRight).toFixed(0)}% L · spread ±{s.latSpread.toFixed(0)}y
              </div>
            )}
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
        );
      })}
    </div>
  );
}
