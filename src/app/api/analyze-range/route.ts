import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnthropic, COACH_MODEL } from "@/lib/anthropic";

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

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

  const session = await prisma.rangeSession.findUnique({
    where: { id: sessionId },
    include: { shots: true },
  });
  if (!session) return NextResponse.json({ error: "no encontrada" }, { status: 404 });

  if (session.aiAnalysis) {
    return NextResponse.json({ analysis: session.aiAnalysis, cached: true });
  }

  // Encontrar sesión anterior con mismo palo (para comparar)
  const prevSession = await prisma.rangeSession.findFirst({
    where: { club: session.club, id: { not: session.id }, date: { lt: session.date } },
    orderBy: { date: "desc" },
    include: { shots: true },
  });

  type ShotRow = (typeof session.shots)[number];
  function avgRow(shots: ShotRow[]) {
    const explicit = shots.find((s: ShotRow) => s.rowType === "AVG");
    if (explicit) return explicit;
    const real = shots.filter((s: ShotRow) => s.rowType === "SHOT" && s.carryYds != null);
    if (real.length === 0) return null;
    const avg = (k: keyof ShotRow) => {
      const nums = real
        .map((r: ShotRow) => r[k])
        .filter((v): v is number => typeof v === "number");
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };
    return {
      carryYds: avg("carryYds"),
      totalYds: avg("totalYds"),
      ballSpeedMph: avg("ballSpeedMph"),
      clubSpeedMph: avg("clubSpeedMph"),
      smashFactor: avg("smashFactor"),
      spinRpm: avg("spinRpm"),
      aoaDeg: avg("aoaDeg"),
      lateralYds: avg("lateralYds"),
    };
  }

  const cur = avgRow(session.shots);
  const prev = prevSession ? avgRow(prevSession.shots) : null;

  const prompt = `Sos un performance coach de golf. Analizá esta sesión de FlightScope con ${CLUB_LABEL[session.club] ?? session.club} y dame:

1. Los 2-3 problemas más importantes basados en los números
2. Los 1-2 puntos fuertes a mantener
3. 3 drills específicos para la próxima sesión
4. KPIs objetivo para la próxima sesión

Promedios actuales (${session.shots.filter((s: ShotRow) => s.rowType === "SHOT").length} shots):
${cur ? Object.entries(cur).map(([k, v]) => `  - ${k}: ${typeof v === "number" ? v.toFixed(2) : v}`).join("\n") : "(sin datos)"}

${prev ? `Sesión anterior (${prevSession?.date.toLocaleDateString("es-AR")}):
${Object.entries(prev).map(([k, v]) => `  - ${k}: ${typeof v === "number" ? v.toFixed(2) : v}`).join("\n")}` : ""}

${session.notes ? `Notas: ${session.notes}` : ""}

Respondé en markdown, conciso, mobile-friendly. Tono directo de coach argentino.`;

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

  await prisma.rangeSession.update({
    where: { id: sessionId },
    data: { aiAnalysis: text },
  });

  return NextResponse.json({ analysis: text, cached: false });
}
