import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { DRILL_BY_TYPE, CLUB_LABEL, type DrillType } from "@/lib/pp-drills";
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
        const attempts = (d.attemptsJson as number[] | null) ?? [];
        const setBest = attempts.length === 0
          ? null
          : def.scoring === "BEAT_BEST_LOWER_BY_1"
          ? attempts.reduce((a, b) => a + b, 0)
          : Math.max(...attempts);

        return (
          <Card
            key={d.id}
            className="space-y-2"
            style={d.leveledUp ? { borderLeft: "4px solid var(--green)" } : undefined}
          >
            <div className="flex justify-between items-baseline">
              <div>
                <span className="font-semibold">{def.label}</span>
                <span className="ml-2 gf-pill text-[10px]">PP {d.ppCode ?? def.ppCode}</span>
              </div>
              {d.leveledUp && <Pill variant="accent">🎯 Subió de nivel</Pill>}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {d.club ? `Palo: ${CLUB_LABEL[d.club] ?? d.club} · ` : ""}
              {d.distance != null ? `Distancia ${d.distance}${def.distanceUnit}` : ""}
              {d.target != null && ` · Mejor anterior: ${d.target}${def.scoring !== "BEAT_BEST_LOWER_BY_1" ? `/${def.scoreOf}` : ""}`}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Intentos · {def.scoreLabel}
              </div>
              {attempts.length === 0 ? (
                <span className="text-xs text-[var(--muted)]">— sin intentos cargados</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {attempts.map((a, i) => {
                    const isBest = def.scoring === "BEAT_BEST_LOWER_BY_1"
                      ? false
                      : a === setBest;
                    return (
                      <span
                        key={i}
                        className="gf-pill gf-mono"
                        style={{
                          background: isBest ? "var(--green-pale)" : undefined,
                          color: isBest ? "var(--green)" : undefined,
                          fontWeight: isBest ? 700 : 500,
                        }}
                      >
                        {def.scoring === "BEAT_BEST_LOWER_BY_1" ? `B${i + 1}` : `#${i + 1}`}: {a}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {setBest != null && (
              <div className="text-xs gf-mono text-[var(--fairway)] font-bold">
                {def.scoring === "BEAT_BEST_LOWER_BY_1" ? "Suma del set" : "Mejor del día"}: {setBest}
                {def.scoring !== "BEAT_BEST_LOWER_BY_1" && ` / ${def.scoreOf}`}
              </div>
            )}
            {d.notes && (
              <div className="text-xs text-[var(--muted)]">{d.notes}</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
