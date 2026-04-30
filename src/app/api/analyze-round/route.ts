import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnthropic, COACH_MODEL } from "@/lib/anthropic";
import { computeRoundKPIs, computePPPlan, type HoleData } from "@/lib/scoring-method";

export async function POST(req: NextRequest) {
  const { roundId } = await req.json();
  if (!roundId) return NextResponse.json({ error: "missing roundId" }, { status: 400 });

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        where: { player: { isMe: true } },
        include: { player: true, holes: true },
      },
    },
  });
  if (!round || round.players.length === 0) {
    return NextResponse.json({ error: "ronda o jugador 'yo' no encontrados" }, { status: 404 });
  }
  const me = round.players[0];
  const parByNumber = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const holes: HoleData[] = me.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: parByNumber.get(h.holeNumber) ?? 4,
    strokesToEnterSz: h.strokesToEnterSz,
    distanceInRegYds: h.distanceInRegYds,
    strokesInsideSz: h.strokesInsideSz,
    putts: h.putts,
    firstPuttDistanceFt: h.firstPuttDistanceFt,
    puttMadeDistanceFt: h.puttMadeDistanceFt,
    puttsInside1PuttCircle: h.puttsInside1PuttCircle,
    score: h.score,
  }));

  const config = {
    enterSzYds: round.enterSzYds,
    downInSzStrokes: round.downInSzStrokes,
    onePuttCircleFt: round.onePuttCircleFt,
    twoPuttCircleYds: round.twoPuttCircleYds,
  };
  const kpis = computeRoundKPIs(holes, config);
  const ppPlan = computePPPlan(holes, config, kpis);

  const prompt = `Sos un performance coach de golf usando el Scoring Method de Will Robins. Analizá esta ronda y dame:

1. Los 2-3 problemas más importantes basados en los números (en español argentino)
2. Los 1-2 puntos fuertes a mantener
3. 3 drills específicos para la próxima sesión de práctica enfocados en los problemas detectados
4. Un mensaje motivador corto (1 línea)

Configuración de la ronda:
- Enter SZ: ${config.enterSzYds} yds
- Down in SZ: ${config.downInSzStrokes} golpes
- 1-putt circle: ${config.onePuttCircleFt} ft

Resultado:
- Score: ${kpis.totalScore} (${kpis.scoreVsPar >= 0 ? "+" : ""}${kpis.scoreVsPar} vs par)
- % sin doble bogey: ${kpis.pctNoDoubleBogey.toFixed(1)}%
- Enter SZ: ${kpis.enterSzCount}/${kpis.holesPlayed} hoyos
- Down in SZ: ${kpis.downInSzCount}/${kpis.holesPlayed} hoyos
- Total putts: ${kpis.totalPutts} (avg ${kpis.avgPuttsPerHole.toFixed(1)}/hoyo)
- 3-puttea hoyos: ${kpis.threePuttsHoles}
- Putts errados dentro de 1-putt circle: ${kpis.missedIn1PuttCircleHoles}

Distribución Distancia REG cuando entró a SZ: >100=${kpis.enterSzBuckets.over100}, ≤100=${kpis.enterSzBuckets.under100}, ≤50=${kpis.enterSzBuckets.under50}, ≤25=${kpis.enterSzBuckets.under25}, GIR=${kpis.enterSzBuckets.gir}

Distribución golpes desde SZ: ≥5=${kpis.downInSzBuckets.over5}, 4=${kpis.downInSzBuckets.s4}, 3=${kpis.downInSzBuckets.s3}, 2=${kpis.downInSzBuckets.s2}, 1=${kpis.downInSzBuckets.s1}, 0=${kpis.downInSzBuckets.s0}

PP Plan codes:
${ppPlan.map((p) => `  - ${p.label}: ${p.count} hoyos (${p.reason})`).join("\n")}

Respondé en markdown, conciso, mobile-friendly. Tono directo de caddie/coach argentino.`;

  const client = getAnthropic();
  const message = await client.messages.create({
    model: COACH_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  // cachear
  // (no hay campo aiAnalysis en Round; podríamos agregarlo. Por ahora solo devolvemos.)

  return NextResponse.json({ analysis: text, kpis, ppPlan });
}
