import { prisma } from "@/lib/db";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

type HoleStat = {
  number: number;
  par: number;
  hcpHoyo: number;
  rounds: number;
  // Score
  scoreSum: number;
  scoreMin: number | null;
  scoreMax: number | null;
  // Score vs par
  birdiesOrBetter: number;
  pars: number;
  bogeys: number;
  doubleOrWorse: number;
  // Scoring Method per hole
  enterSzData: number;
  enterSzHits: number;
  girData: number;
  gir: number; // distanceInRegYds === 0
  downInSzData: number;
  downInSzHits: number;
  puttsData: number;
  puttsSum: number;
  threePutts: number;
  onePcData: number;
  missedIn1Pc: number;
};

export default async function StatsPorHoyoPage() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) {
    return (
      <div className="px-4 pt-6">
        <Card className="text-center">
          <p className="text-sm text-[var(--muted)] mb-3">Configurá tu perfil primero</p>
          <Link href="/jugadores" className="gf-btn inline-block">Ir a Setup</Link>
        </Card>
      </div>
    );
  }

  // Traer todas las rondas con datos del jugador "yo"
  const rounds = await prisma.round.findMany({
    where: { players: { some: { playerId: me.id } } },
    orderBy: { date: "desc" },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: { where: { playerId: me.id }, include: { holes: true } },
    },
  });

  // Agrupar por cancha
  type CourseAgg = {
    courseId: string;
    courseName: string;
    enterSzYds: number;
    holes: HoleStat[];
  };
  const courseMap = new Map<string, CourseAgg>();

  for (const r of rounds) {
    const meRP = r.players[0];
    if (!meRP) continue;

    let courseAgg = courseMap.get(r.courseId);
    if (!courseAgg) {
      courseAgg = {
        courseId: r.courseId,
        courseName: r.course.name,
        enterSzYds: r.enterSzYds, // del primero — asume estable
        holes: r.course.holes.map((h) => ({
          number: h.number,
          par: h.par,
          hcpHoyo: h.hcpHoyo,
          rounds: 0,
          scoreSum: 0,
          scoreMin: null,
          scoreMax: null,
          birdiesOrBetter: 0,
          pars: 0,
          bogeys: 0,
          doubleOrWorse: 0,
          enterSzData: 0,
          enterSzHits: 0,
          girData: 0,
          gir: 0,
          downInSzData: 0,
          downInSzHits: 0,
          puttsData: 0,
          puttsSum: 0,
          threePutts: 0,
          onePcData: 0,
          missedIn1Pc: 0,
        })),
      };
      courseMap.set(r.courseId, courseAgg);
    }

    for (const hd of meRP.holes) {
      const stat = courseAgg.holes.find((h) => h.number === hd.holeNumber);
      if (!stat) continue;
      const score = hd.score;
      if (score == null || score <= 0) continue;

      stat.rounds++;
      stat.scoreSum += score;
      if (stat.scoreMin == null || score < stat.scoreMin) stat.scoreMin = score;
      if (stat.scoreMax == null || score > stat.scoreMax) stat.scoreMax = score;

      const vsPar = score - stat.par;
      if (vsPar <= -1) stat.birdiesOrBetter++;
      else if (vsPar === 0) stat.pars++;
      else if (vsPar === 1) stat.bogeys++;
      else stat.doubleOrWorse++;

      if (hd.distanceInRegYds != null) {
        stat.enterSzData++;
        stat.girData++;
        if (hd.distanceInRegYds === 0) stat.gir++;
        if (hd.distanceInRegYds <= r.enterSzYds) stat.enterSzHits++;
      }
      if (hd.strokesInsideSz != null) {
        stat.downInSzData++;
        if (hd.strokesInsideSz <= r.downInSzStrokes) stat.downInSzHits++;
      }
      if (hd.putts != null) {
        stat.puttsData++;
        stat.puttsSum += hd.putts;
        if (hd.putts >= 3) stat.threePutts++;
      }
      if (hd.puttsInside1PuttCircle != null) {
        stat.onePcData++;
        if (hd.puttsInside1PuttCircle > 1) stat.missedIn1Pc++;
      }
    }
  }

  const courses = Array.from(courseMap.values()).filter((c) =>
    c.holes.some((h) => h.rounds > 0),
  );

  function pct(num: number, den: number): string {
    if (den === 0) return "—";
    return `${Math.round((num / den) * 100)}%`;
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/stats" className="text-xs text-[var(--muted)]">
          ‹ Volver
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          Stats por hoyo
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Performance por hoyo agregada de todas tus rondas
        </p>
      </header>

      {courses.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          No hay rondas con datos cargados todavía
        </Card>
      )}

      {courses.map((c) => {
        // Top 3 hoyos peor desempeño (por score vs par promedio)
        const playedHoles = c.holes.filter((h) => h.rounds > 0);
        const withVsPar = playedHoles.map((h) => ({
          ...h,
          avgScore: h.scoreSum / h.rounds,
          avgVsPar: h.scoreSum / h.rounds - h.par,
        }));
        const peores = [...withVsPar].sort((a, b) => b.avgVsPar - a.avgVsPar).slice(0, 3);
        const mejores = [...withVsPar].sort((a, b) => a.avgVsPar - b.avgVsPar).slice(0, 3);

        return (
          <div key={c.courseId} className="space-y-3">
            <SectionHeader>{c.courseName}</SectionHeader>

            <div className="grid grid-cols-2 gap-2">
              <Card className="!p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  Top 3 mejores hoyos
                </div>
                {mejores.map((h) => (
                  <div key={h.number} className="text-xs gf-mono flex justify-between mt-1">
                    <span>Hoyo {h.number} (par {h.par})</span>
                    <span className="text-[var(--green)] font-bold">
                      {h.avgVsPar > 0 ? "+" : ""}{h.avgVsPar.toFixed(1)}
                    </span>
                  </div>
                ))}
              </Card>
              <Card className="!p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  Top 3 peores hoyos
                </div>
                {peores.map((h) => (
                  <div key={h.number} className="text-xs gf-mono flex justify-between mt-1">
                    <span>Hoyo {h.number} (par {h.par})</span>
                    <span className="text-[var(--red)] font-bold">
                      {h.avgVsPar > 0 ? "+" : ""}{h.avgVsPar.toFixed(1)}
                    </span>
                  </div>
                ))}
              </Card>
            </div>

            <Card className="!p-2 overflow-x-auto">
              <table className="w-full text-[10px]" style={{ minWidth: 600 }}>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left p-1 text-[9px] uppercase text-[var(--muted)]">H</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">Par</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">Vlt</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">Avg</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">±Par</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">GIR</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">SZ</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">DnSZ</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">Putts</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">3p</th>
                    <th className="p-1 text-[9px] uppercase text-[var(--muted)]">2x+</th>
                  </tr>
                </thead>
                <tbody>
                  {c.holes.map((h) => {
                    if (h.rounds === 0) {
                      return (
                        <tr key={h.number} className="border-b border-[var(--green-pale)] text-[var(--muted)]">
                          <td className="p-1 gf-mono">{h.number}</td>
                          <td className="p-1 gf-mono text-center">{h.par}</td>
                          <td colSpan={9} className="p-1 text-center text-[10px]">— sin jugar —</td>
                        </tr>
                      );
                    }
                    const avg = h.scoreSum / h.rounds;
                    const vsPar = avg - h.par;
                    const tone = vsPar < 0 ? "var(--green)" : vsPar < 1 ? "var(--ink)" : vsPar < 2 ? "var(--accent)" : "var(--red)";
                    return (
                      <tr key={h.number} className="border-b border-[var(--green-pale)]">
                        <td className="p-1 gf-mono font-semibold">{h.number}</td>
                        <td className="p-1 gf-mono text-center">{h.par}</td>
                        <td className="p-1 gf-mono text-center">{h.rounds}</td>
                        <td className="p-1 gf-mono text-center" style={{ color: tone, fontWeight: 600 }}>
                          {avg.toFixed(1)}
                        </td>
                        <td className="p-1 gf-mono text-center" style={{ color: tone }}>
                          {vsPar > 0 ? "+" : ""}{vsPar.toFixed(1)}
                        </td>
                        <td className="p-1 gf-mono text-center">{pct(h.gir, h.girData)}</td>
                        <td className="p-1 gf-mono text-center">{pct(h.enterSzHits, h.enterSzData)}</td>
                        <td className="p-1 gf-mono text-center">{pct(h.downInSzHits, h.downInSzData)}</td>
                        <td className="p-1 gf-mono text-center">
                          {h.puttsData > 0 ? (h.puttsSum / h.puttsData).toFixed(1) : "—"}
                        </td>
                        <td className="p-1 gf-mono text-center">{h.threePutts || "—"}</td>
                        <td className="p-1 gf-mono text-center">{h.doubleOrWorse || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-[9px] text-[var(--muted)] mt-1 px-1">
                Vlt = vueltas jugadas. GIR = % en green directo. SZ = % entró a Scoring Zone (≤ {c.enterSzYds} yds). DnSZ = % bajó en {/* downInSzStrokes varia por ronda — simplemente texto */}≤3 desde SZ. 3p = hoyos con 3+ putts. 2x+ = doble bogey o peor.
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
