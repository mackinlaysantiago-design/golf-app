import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import RangeAnalisisIA from "./RangeAnalisisIA";
import EditarRangeSesion from "./EditarRangeSesion";
import ShotsTable from "./ShotsTable";
import CLUB_LABEL from "@/lib/club-labels";

export const dynamic = "force-dynamic";

type Shot = {
  id: string;
  shotNumber: number;
  rowType: string;
  club: string | null;
  carryYds: number | null;
  rollYds: number | null;
  totalYds: number | null;
  lateralYds: number | null;
  lateralDir: string | null;
  clubSpeedMph: number | null;
  ballSpeedMph: number | null;
  spinRpm: number | null;
  smashFactor: number | null;
  aoaDeg: number | null;
  shotType: string | null;
};

function avgForClub(shots: Shot[]) {
  const real = shots.filter((s) => s.rowType === "SHOT" && s.carryYds != null);
  if (real.length === 0) return null;
  const safeAvg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v != null);
    return valid.length === 0 ? null : valid.reduce((s, v) => s + v, 0) / valid.length;
  };
  return {
    n: real.length,
    carry: safeAvg(real.map((s) => s.carryYds)),
    total: safeAvg(real.map((s) => s.totalYds)),
    smash: safeAvg(real.map((s) => s.smashFactor)),
    ballSpeed: safeAvg(real.map((s) => s.ballSpeedMph)),
    spin: safeAvg(real.map((s) => s.spinRpm)),
  };
}

function dispersionForClub(shots: Shot[]) {
  const lateralYds = shots
    .filter((s) => s.rowType === "SHOT")
    .map((s) => {
      if (s.lateralYds == null) return null;
      return s.lateralDir === "L" ? -s.lateralYds : s.lateralYds;
    })
    .filter((v): v is number => v !== null);
  const minLat = lateralYds.length > 0 ? Math.min(...lateralYds) : 0;
  const maxLat = lateralYds.length > 0 ? Math.max(...lateralYds) : 0;
  const range = Math.max(Math.abs(minLat), Math.abs(maxLat), 10);
  return { lateralYds, minLat, maxLat, range };
}

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

  // Agrupar shots por club (fallback a session.club si shot.club es null)
  const groups = new Map<string, Shot[]>();
  for (const s of session.shots) {
    const club = s.club ?? session.club;
    if (!groups.has(club)) groups.set(club, []);
    groups.get(club)!.push(s as unknown as Shot);
  }
  const clubsInOrder = Array.from(groups.keys());
  const isMultiClub = clubsInOrder.length > 1;

  const totalShotsCount = session.shots.filter(
    (s) => s.rowType === "SHOT" && s.carryYds != null,
  ).length;

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range" className="text-xs text-[var(--muted)]">
          ‹ Volver
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          {isMultiClub
            ? `Sesión · ${clubsInOrder.length} palos`
            : (CLUB_LABEL[session.club] ?? session.club)}
        </h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(session.date).toLocaleDateString("es-AR")} · {totalShotsCount} shots
          {isMultiClub && ` · ${clubsInOrder.map((c) => CLUB_LABEL[c] ?? c).join(", ")}`}
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

      {/* Por cada palo: promedios + dispersión */}
      {clubsInOrder.map((club) => {
        const shotsOfClub = groups.get(club)!;
        const avg = avgForClub(shotsOfClub);
        const disp = dispersionForClub(shotsOfClub);
        const title = CLUB_LABEL[club] ?? club;

        return (
          <div key={club} className="space-y-3">
            <SectionHeader>
              {isMultiClub ? `${title} · Promedios` : "Promedios"}
            </SectionHeader>
            {avg ? (
              <div className="grid grid-cols-2 gap-3">
                <KPI
                  label="Carry"
                  value={avg.carry?.toFixed(1) ?? "—"}
                  unit="yds"
                  hint={`${avg.n} shots`}
                />
                <KPI label="Total" value={avg.total?.toFixed(1) ?? "—"} unit="yds" />
                <KPI label="Ball speed" value={avg.ballSpeed?.toFixed(1) ?? "—"} unit="mph" />
                <KPI label="Smash" value={avg.smash?.toFixed(2) ?? "—"} />
                <KPI label="Spin" value={avg.spin?.toFixed(0) ?? "—"} unit="rpm" />
                <KPI
                  label="Disp. lateral"
                  value={(disp.maxLat - disp.minLat).toFixed(1)}
                  unit="yds"
                  hint={`L${Math.abs(disp.minLat).toFixed(0)} → R${Math.abs(disp.maxLat).toFixed(0)}`}
                />
              </div>
            ) : (
              <Card className="text-center text-sm text-[var(--muted)]">
                Sin shots con datos
              </Card>
            )}

            {disp.lateralYds.length > 0 && (
              <Card>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
                  Dispersión lateral
                </div>
                <div className="relative h-20 bg-[var(--green-pale)] rounded-lg">
                  <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-[var(--fairway)]" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-[var(--fairway)]" />
                  {disp.lateralYds.map((y, i) => {
                    const pct = 50 + (y / disp.range) * 45;
                    return (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-[var(--accent)]"
                        style={{
                          left: `${pct}%`,
                          top: `${30 + (i % 5) * 8}%`,
                          transform: "translate(-50%,-50%)",
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] gf-mono text-[var(--muted)] mt-1">
                  <span>L {Math.abs(disp.minLat).toFixed(0)}</span>
                  <span>0</span>
                  <span>R {disp.maxLat.toFixed(0)}</span>
                </div>
              </Card>
            )}
          </div>
        );
      })}

      <RangeAnalisisIA sessionId={session.id} cachedAnalysis={session.aiAnalysis} />

      <SectionHeader>Tabla shots (✕ para borrar outliers)</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        <ShotsTable shots={session.shots} sessionClub={session.club} />
      </Card>
    </div>
  );
}
