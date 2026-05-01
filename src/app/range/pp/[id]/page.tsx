import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { DRILL_BY_TYPE, type DrillType } from "@/lib/pp-drills";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PPSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.practiceSession.findUnique({
    where: { id },
    include: { drills: true },
  });
  if (!session) return notFound();

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range/pp" className="text-xs text-[var(--muted)]">
          ‹ Volver
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          Sesión PP
        </h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(session.date).toLocaleDateString("es-AR")} · {session.drills.length} drills
        </p>
        {session.notes && (
          <p className="text-xs text-[var(--muted)] mt-1">{session.notes}</p>
        )}
      </header>

      <SectionHeader>Resultados</SectionHeader>
      {session.drills.map((d) => {
        const def = DRILL_BY_TYPE[d.drillType as DrillType];
        if (!def) return null;
        const pct = d.successes != null && d.attempts != null && d.attempts > 0
          ? Math.round((d.successes / d.attempts) * 100)
          : null;
        return (
          <Card key={d.id} className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold">{def.label}</span>
              {pct != null && (
                <Pill variant={pct >= 70 ? "default" : pct >= 40 ? "accent" : "red"}>
                  {pct}%
                </Pill>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase text-[var(--muted)]">Distancia</div>
                <div className="gf-display text-2xl">
                  {d.distance ?? "—"}
                  <span className="text-xs ml-0.5">{def.distanceUnit}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[var(--muted)]">Intentos</div>
                <div className="gf-display text-2xl">{d.attempts ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[var(--muted)]">Score</div>
                <div className="gf-display text-2xl">{d.successes ?? "—"}</div>
              </div>
            </div>
            {d.notes && (
              <div className="text-xs text-[var(--muted)]">{d.notes}</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
