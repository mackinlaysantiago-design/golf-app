import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ShotSchema = z.object({
  shotNumber: z.number().int(),
  rowType: z.enum(["SHOT", "AVG", "DEV"]).default("SHOT"),
  club: z.string().nullable().optional(),
  carryYds: z.number().nullable().optional(),
  rollYds: z.number().nullable().optional(),
  totalYds: z.number().nullable().optional(),
  lateralYds: z.number().nullable().optional(),
  lateralDir: z.string().nullable().optional(),
  clubSpeedMph: z.number().nullable().optional(),
  ballSpeedMph: z.number().nullable().optional(),
  spinRpm: z.number().int().nullable().optional(),
  spinAxisDeg: z.number().nullable().optional(),
  spinAxisDir: z.string().nullable().optional(),
  spinLoftDeg: z.number().nullable().optional(),
  smashFactor: z.number().nullable().optional(),
  verticalAngleDeg: z.number().nullable().optional(),
  horizontalAngleDeg: z.number().nullable().optional(),
  horizontalDir: z.string().nullable().optional(),
  aoaDeg: z.number().nullable().optional(),
  heightFt: z.number().nullable().optional(),
  timeSec: z.number().nullable().optional(),
  shotType: z.string().nullable().optional(),
});

const Body = z.object({
  shots: z.array(ShotSchema).min(1),
});

// POST /api/range-sessions/[id]/shots — appendea shots a una sesión existente.
// Renumera shotNumber para evitar colisión con los existentes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = Body.parse(body);

  // Encontrar el max shotNumber actual para los SHOT (no AVG/DEV)
  const existingShot = await prisma.rangeShot.findMany({
    where: { sessionId: id, rowType: "SHOT" },
    select: { shotNumber: true },
    orderBy: { shotNumber: "desc" },
    take: 1,
  });
  const baseNum = existingShot[0]?.shotNumber ?? 0;

  // Renumerar SHOTs nuevos consecutivos. AVG/DEV mantenidos como están —
  // si ya existe AVG/DEV, los nuevos pisarían (constraint unique)
  // → mejor saltarlos en el segundo upload (filtrar)
  const existingAvgDev = await prisma.rangeShot.findMany({
    where: { sessionId: id, rowType: { in: ["AVG", "DEV"] } },
    select: { rowType: true },
  });
  const haveAvg = existingAvgDev.some((s) => s.rowType === "AVG");
  const haveDev = existingAvgDev.some((s) => s.rowType === "DEV");

  const dataToCreate: typeof parsed.shots = [];
  let nextNum = baseNum + 1;
  for (const s of parsed.shots) {
    if (s.rowType === "AVG" && haveAvg) continue;
    if (s.rowType === "DEV" && haveDev) continue;
    if (s.rowType === "SHOT") {
      dataToCreate.push({ ...s, shotNumber: nextNum++ });
    } else {
      dataToCreate.push(s);
    }
  }

  // Filtrar outliers POR CLUB antes de guardar
  const { filterClubOutliers } = await import("@/lib/range-outlier");
  const session = await prisma.rangeSession.findUnique({ where: { id }, select: { club: true } });
  const byClub = new Map<string, typeof dataToCreate>();
  for (const s of dataToCreate) {
    const k = s.club ?? session?.club ?? "DRIVER";
    if (!byClub.has(k)) byClub.set(k, []);
    byClub.get(k)!.push(s);
  }
  const keptShots: typeof dataToCreate = [];
  const discarded: { reason: string; shotNumber: number; carry?: number | null }[] = [];
  for (const group of Array.from(byClub.values())) {
    const r = filterClubOutliers(group);
    keptShots.push(...r.kept);
    for (const d of r.discarded) {
      discarded.push({ reason: d.reason, shotNumber: d.shot.shotNumber ?? 0, carry: d.shot.carryYds });
    }
  }

  await prisma.rangeShot.createMany({
    data: keptShots.map((s) => ({ ...s, sessionId: id })),
  });

  // Invalidar el AI analysis (los promedios cambiaron)
  await prisma.rangeSession.update({
    where: { id },
    data: { aiAnalysis: null },
  });

  return NextResponse.json({
    ok: true,
    added: keptShots.length,
    discardedCount: discarded.length,
    discarded,
  });
}
