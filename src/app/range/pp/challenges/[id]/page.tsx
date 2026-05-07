import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_CHALLENGES } from "@/lib/sm-challenges";
import { DRILL_BY_TYPE } from "@/lib/pp-drills";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challenge = ALL_CHALLENGES.find((c) => c.id === id);
  if (!challenge) notFound();

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range/pp/challenges" className="text-xs text-[var(--muted)]">
          ‹ Volver a Challenges
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          {challenge.title}
        </h1>
        <p className="text-sm text-[var(--muted)]">{challenge.description}</p>
      </header>

      <SectionHeader>Plan</SectionHeader>
      <div className="space-y-2">
        {challenge.days.map((day) => (
          <Card key={day.day} className="!p-3 space-y-2">
            <div className="flex justify-between items-baseline">
              <h3 className="font-bold text-[var(--fairway)]">{day.title}</h3>
              <span className="gf-pill text-[10px]">Día {day.day}</span>
            </div>
            <p className="text-xs text-[var(--muted)]">{day.description}</p>
            <div className="text-[10px] text-[var(--muted)] gf-mono">
              Drills: {day.drills.map((dt) => DRILL_BY_TYPE[dt]?.shortLabel ?? dt).join(" · ")}
            </div>
            <Link
              href={`/range/pp/nueva?challenge=${challenge.id}&day=${day.day}`}
              className="gf-btn !text-xs !py-1.5 inline-block"
            >
              Empezar día {day.day}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
