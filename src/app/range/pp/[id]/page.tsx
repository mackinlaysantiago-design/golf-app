import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import {
  DRILL_BY_TYPE,
  CLUB_LABEL,
  parseAttempts,
  ratioLowerByDistance,
  ratioHigherTotal,
  type DrillType,
  distToUi,
  uiUnit,
} from "@/lib/pp-drills";
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
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">Sesión PP</h1>
        <p className="text-xs text-[var(--muted)] gf-mono">
          {new Date(session.date).toLocaleDateString("es-AR")} · {session.drills.length} drills
        </p>
        {session.notes && <p className="text-xs text-[var(--muted)] mt-1">{session.notes}</p>}
      </header>

      <SectionHeader>Resultados</SectionHeader>
      {session.drills.map((d) => {
        const def = DRILL_BY_TYPE[d.drillType as DrillType];
        if (!def) return null;
        const data = parseAttempts(d.attemptsJson, def.format);

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
            {d.club && (
              <div className="text-xs text-[var(--muted)]">
                Palo: {CLUB_LABEL[d.club] ?? d.club}
              </div>
            )}

            {data.type === "STREAK_BY_DIST" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Intentos · racha por distancia
                </div>
                {data.attempts.length === 0 ? (
                  <span className="text-xs text-[var(--muted)]">— sin intentos</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {data.attempts.map((a, i) => (
                      <span key={i} className="gf-pill gf-mono">
                        #{i + 1}: {distToUi(def, a.distance)} {uiUnit(def)} → {a.streak}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {data.type === "RATIO_LOWER_BY_DIST" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Intentos · golpes / pelotas
                </div>
                {data.attempts.length === 0 ? (
                  <span className="text-xs text-[var(--muted)]">— sin intentos</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {data.attempts.map((a, i) => (
                      <span key={i} className="gf-pill gf-mono">
                        #{i + 1}: {distToUi(def, a.distance)} {uiUnit(def)} → {a.strokes}/{a.balls} ({(a.strokes / a.balls).toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}
                {(() => {
                  const byDist = ratioLowerByDistance(data.attempts);
                  const dists = Object.keys(byDist).map(Number).sort((a, b) => a - b);
                  if (dists.length === 0) return null;
                  return (
                    <div className="text-xs gf-mono text-[var(--fairway)] font-bold mt-2">
                      Sesión: {dists.map((dd) => `${distToUi(def, dd)} ${uiUnit(def)}: ${byDist[dd].ratio.toFixed(2)}`).join(" · ")}
                    </div>
                  );
                })()}
              </div>
            )}

            {data.type === "RATIO_HIGHER" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Intentos · dentro / pelotas
                </div>
                {data.attempts.length === 0 ? (
                  <span className="text-xs text-[var(--muted)]">— sin intentos</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {data.attempts.map((a, i) => (
                      <span key={i} className="gf-pill gf-mono">
                        #{i + 1}: {a.inTarget}/{a.balls} ({((a.inTarget / a.balls) * 100).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                )}
                {(() => {
                  const t = ratioHigherTotal(data.attempts);
                  if (!t) return null;
                  return (
                    <div className="text-xs gf-mono text-[var(--fairway)] font-bold mt-2">
                      Sesión: {(t.ratio * 100).toFixed(0)}% ({t.inTarget}/{t.balls})
                    </div>
                  );
                })()}
              </div>
            )}

            {data.type === "LEGACY_NUMBER_ARRAY" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Intentos · {def.scoreLabel}
                </div>
                {data.attempts.length === 0 ? (
                  <span className="text-xs text-[var(--muted)]">— sin intentos</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {data.attempts.map((a, i) => (
                      <span key={i} className="gf-pill gf-mono">
                        #{i + 1}: {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {d.notes && <div className="text-xs text-[var(--muted)]">{d.notes}</div>}
          </Card>
        );
      })}
    </div>
  );
}
