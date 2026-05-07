import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import { ALL_CHALLENGES } from "@/lib/sm-challenges";
import { DRILL_BY_TYPE } from "@/lib/pp-drills";

export const dynamic = "force-dynamic";

export default function ChallengesPage() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range/pp" className="text-xs text-[var(--muted)]">
          ‹ Volver a PP
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          Challenges guiados
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Programas estructurados para trabajar áreas específicas
        </p>
      </header>

      <div className="space-y-3">
        {ALL_CHALLENGES.map((c) => (
          <Link key={c.id} href={`/range/pp/challenges/${c.id}`}>
            <Card className="!p-3" style={{ borderLeft: "4px solid var(--accent)" }}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {c.description}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] gf-mono mt-2">
                    {c.days.length} días · drills:{" "}
                    {Array.from(new Set(c.days.flatMap((d) => d.drills)))
                      .map((dt) => DRILL_BY_TYPE[dt]?.shortLabel ?? dt)
                      .join(", ")}
                  </div>
                </div>
                <span className="text-2xl">›</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <SectionHeader>Drills sueltos</SectionHeader>
      <p className="text-xs text-[var(--muted)]">
        Si no querés seguir un challenge, podés cargar drills sueltos desde
        cualquier área de juego.
      </p>
      <Link href="/range/pp/nueva" className="gf-btn w-full">
        + Nueva sesión libre
      </Link>
    </div>
  );
}
