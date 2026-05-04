import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import RangeAnalisisIA from "./RangeAnalisisIA";
import EditarRangeSesion from "./EditarRangeSesion";

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

export default async function RangeSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.rangeSession.findUnique({
    where: { id },
    include: { shots: { orderBy: [{ rowType: "asc" }, { shotNumber: "asc" }] } },
  });
  if (!session) return notFound();

  const realShots = session.shots.filter((s) => s.rowType === "SHOT" && s.carryYds != null);
  const avg = realShots.length > 0
    ? {
        carry: realShots.reduce((s, x) => s + (x.carryYds ?? 0), 0) / realShots.length,
        total: realShots.reduce((s, x) => s + (x.totalYds ?? 0), 0) / realShots.length,
        smash: realShots.filter((x) => x.smashFactor != null).reduce((s, x) => s + (x.smashFactor ?? 0), 0) /
          (realShots.filter((x) => x.smashFactor != null).length || 1),
        ballSpeed: realShots.filter((x) => x.ballSpeedMph != null).reduce((s, x) => s + (x.ballSpeedMph ?? 0), 0) /
          (realShots.filter((x) => x.ballSpeedMph != null).length || 1),
        spin: realShots.filter((x) => x.spinRpm != null).reduce((s, x) => s + (x.spinRpm ?? 0), 0) /
          (realShots.filter((x) => x.spinRpm != null).length || 1),
      }
    : null;

  // Dispersión lateral: max y min
  const lateralYds = realShots
    .map((s) => {
      if (s.lateralYds == null) return null;
      return s.lateralDir === "L" ? -s.lateralYds : s.lateralYds;
    })
    .filter((v): v is number => v !== null);
  const minLat = lateralYds.length > 0 ? Math.min(...lateralYds) : 0;
  const maxLat = lateralYds.length > 0 ? Math.max(...lateralYds) : 0;
  const range = Math.max(Math.abs(minLat), Math.abs(maxLat), 10);

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range" className="text-xs text-[var(--muted)]">
          ‹ Volver
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          {CLUB_LABEL[session.club] ?? session.club}
        </h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(session.date).toLocaleDateString("es-AR")} · {realShots.length} shots
        </p>
        <div className="mt-2">
          <EditarRangeSesion
            sessionId={session.id}
            initialClub={session.club}
            initialDate={session.date.toISOString()}
            initialNotes={session.notes}
          />
        </div>
      </header>

      {avg && (
        <>
          <SectionHeader>Promedios</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <KPI label="Carry" value={avg.carry.toFixed(1)} unit="yds" />
            <KPI label="Total" value={avg.total.toFixed(1)} unit="yds" />
            <KPI label="Ball speed" value={avg.ballSpeed.toFixed(1)} unit="mph" />
            <KPI label="Smash" value={avg.smash.toFixed(2)} />
            <KPI label="Spin" value={avg.spin.toFixed(0)} unit="rpm" />
            <KPI
              label="Disp. lateral"
              value={(maxLat - minLat).toFixed(1)}
              unit="yds"
              hint={`L${Math.abs(minLat).toFixed(0)} → R${Math.abs(maxLat).toFixed(0)}`}
            />
          </div>
        </>
      )}

      {/* Dispersión visual simple */}
      {lateralYds.length > 0 && (
        <>
          <SectionHeader>Dispersión lateral</SectionHeader>
          <Card>
            <div className="relative h-24 bg-[var(--green-pale)] rounded-lg">
              <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-[var(--fairway)]" />
              <div className="absolute top-0 bottom-0 left-1/2 border-l border-[var(--fairway)]" />
              {lateralYds.map((y, i) => {
                const pct = 50 + (y / range) * 45;
                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-[var(--accent)]"
                    style={{
                      left: `${pct}%`,
                      top: `${30 + ((i % 5) * 8)}%`,
                      transform: "translate(-50%,-50%)",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] gf-mono text-[var(--muted)] mt-1">
              <span>L {Math.abs(minLat).toFixed(0)}</span>
              <span>0</span>
              <span>R {maxLat.toFixed(0)}</span>
            </div>
          </Card>
        </>
      )}

      <RangeAnalisisIA sessionId={session.id} cachedAnalysis={session.aiAnalysis} />

      <SectionHeader>Tabla shots</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        <table className="gf-table" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Carry</th>
              <th>Total</th>
              <th>Lat</th>
              <th>Ball</th>
              <th>Club</th>
              <th>Smash</th>
              <th>Spin</th>
              <th>AoA</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {session.shots.map((s) => (
              <tr key={s.id} className={s.rowType !== "SHOT" ? "font-semibold bg-[var(--green-pale)]" : ""}>
                <td className="gf-mono">
                  {s.rowType === "SHOT" ? s.shotNumber : s.rowType}
                </td>
                <td className="gf-mono">{s.carryYds?.toFixed(1) ?? "—"}</td>
                <td className="gf-mono">{s.totalYds?.toFixed(1) ?? "—"}</td>
                <td className="gf-mono">
                  {s.lateralYds != null ? `${s.lateralYds.toFixed(1)}${s.lateralDir ?? ""}` : "—"}
                </td>
                <td className="gf-mono">{s.ballSpeedMph?.toFixed(1) ?? "—"}</td>
                <td className="gf-mono">{s.clubSpeedMph?.toFixed(1) ?? "—"}</td>
                <td className="gf-mono">{s.smashFactor?.toFixed(2) ?? "—"}</td>
                <td className="gf-mono">{s.spinRpm ?? "—"}</td>
                <td className="gf-mono">{s.aoaDeg?.toFixed(1) ?? "—"}</td>
                <td className="text-xs">{s.shotType ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
