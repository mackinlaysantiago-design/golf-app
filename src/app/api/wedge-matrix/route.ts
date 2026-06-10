import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { computeCell, WEDGES, SWING_POSITIONS } from "@/lib/wedge-matrix";

const WEDGE_KEYS = WEDGES.map((w) => w.key) as [string, ...string[]];
const SWING_KEYS = SWING_POSITIONS.map((s) => s.key) as [string, ...string[]];

async function getMe() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) throw new Error("no hay player isMe=true");
  return me;
}

// GET → matriz actual (entry más reciente por celda) + historial de sesiones
export async function GET() {
  const me = await getMe();
  const sessions = await prisma.wedgeMatrixSession.findMany({
    where: { playerId: me.id },
    orderBy: { date: "desc" },
    include: { entries: true },
  });

  // entry más reciente por celda (sessions ya viene desc por fecha)
  const matrix: Record<string, unknown> = {};
  for (const s of sessions) {
    for (const e of s.entries) {
      const k = `${e.wedgeType}__${e.swingType}`;
      if (!matrix[k]) {
        matrix[k] = {
          wedgeType: e.wedgeType,
          swingType: e.swingType,
          avgYards: e.avgYards,
          dispersionYards: e.dispersionYards,
          goalDispersionYards: e.goalDispersionYards,
          isLockedIn: e.isLockedIn,
          chunksOrBladesRejected: e.chunksOrBladesRejected,
          shots: e.shots,
          date: s.date.toISOString(),
        };
      }
    }
  }

  return NextResponse.json({
    player: { id: me.id, name: me.name },
    matrix,
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      notes: s.notes,
      entries: s.entries.length,
    })),
  });
}

const SaveSchema = z.object({
  wedgeType: z.enum(WEDGE_KEYS),
  swingType: z.enum(SWING_KEYS),
  carries: z.array(z.number()).min(1), // carries CONSERVADOS (sin outliers)
  chunksRejected: z.number().int().min(0).default(0),
  goalDispersionYards: z.number().positive().default(4),
  date: z.string().optional(), // ISO; default hoy
  notes: z.string().nullable().optional(),
});

// POST → guarda/actualiza una celda (upsert por sesión del día)
export async function POST(req: NextRequest) {
  const me = await getMe();
  const body = SaveSchema.parse(await req.json());

  const stats = computeCell(body.carries, body.goalDispersionYards);

  // sesión del día (find-or-create)
  const day = body.date ? new Date(body.date) : new Date();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let session = await prisma.wedgeMatrixSession.findFirst({
    where: { playerId: me.id, date: { gte: dayStart, lt: dayEnd } },
  });
  if (!session) {
    session = await prisma.wedgeMatrixSession.create({
      data: { playerId: me.id, date: day, notes: body.notes ?? null },
    });
  }

  const entry = await prisma.wedgeMatrixEntry.upsert({
    where: {
      sessionId_wedgeType_swingType: {
        sessionId: session.id,
        wedgeType: body.wedgeType,
        swingType: body.swingType,
      },
    },
    create: {
      sessionId: session.id,
      wedgeType: body.wedgeType,
      swingType: body.swingType,
      shots: body.carries,
      avgYards: stats.avg ?? 0,
      dispersionYards: stats.dispersion,
      goalDispersionYards: body.goalDispersionYards,
      chunksOrBladesRejected: body.chunksRejected,
      isLockedIn: stats.lockedIn,
    },
    update: {
      shots: body.carries,
      avgYards: stats.avg ?? 0,
      dispersionYards: stats.dispersion,
      goalDispersionYards: body.goalDispersionYards,
      chunksOrBladesRejected: body.chunksRejected,
      isLockedIn: stats.lockedIn,
    },
  });

  return NextResponse.json({ entry, stats }, { status: 201 });
}
