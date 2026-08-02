import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { derivePutts } from "@/lib/putts-derive";
import { deriveSmFromShots } from "@/lib/shots-to-sm";

// Campo Json: `undefined` = no lo toques, `DbNull` = borralo. Distinguirlos importa
// porque si el hoyo se limpia, el array y los campos derivados tienen que irse juntos.
const puttJson = (v: number[] | null | undefined) =>
  v === undefined ? undefined : v === null ? Prisma.DbNull : v;

const HoleEntrySchema = z.object({
  roundPlayerId: z.string(),
  holeNumber: z.number().int().min(1).max(18),
  strokesToEnterSz: z.number().int().nullable().optional(),
  distanceInRegYds: z.number().int().nullable().optional(),
  strokesInsideSz: z.number().int().nullable().optional(),
  putts: z.number().int().nullable().optional(),
  firstPuttDistanceFt: z.number().int().nullable().optional(),
  puttMadeDistanceFt: z.number().int().nullable().optional(),
  puttsInside1PuttCircle: z.number().int().nullable().optional(),
  // Distancia de cada putt en ft, en orden. Cuando viene, MANDA: el server deriva
  // los 4 campos de arriba y pisa lo que haya mandado el cliente.
  puttDistancesFt: z.array(z.number().int().min(0).max(200)).max(10).nullable().optional(),
  pinLat: z.number().nullable().optional(),
  pinLng: z.number().nullable().optional(),
  score: z.number().int().nullable().optional(),
  penaltyStrokes: z.number().int().nullable().optional(),
  keysBroken: z.array(z.number().int().min(1).max(10)).nullable().optional(),
  targetGoal: z.string().nullable().optional(),
  pinColor: z.enum(["GREEN", "YELLOW", "RED"]).nullable().optional(),
  dangerSide: z.enum(["L", "R", "NONE"]).nullable().optional(),
  aimedAtCenter: z.boolean().nullable().optional(),
  recoveryMode: z.boolean().nullable().optional(),
});

const PutSchema = z.object({
  entries: z.array(HoleEntrySchema).min(1),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PutSchema.parse(body);

  // Validar que todos los roundPlayerIds pertenezcan a esta ronda
  const valid = await prisma.roundPlayer.findMany({
    where: { roundId: id, id: { in: parsed.entries.map((e) => e.roundPlayerId) } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const invalid = parsed.entries.filter((e) => !validIds.has(e.roundPlayerId));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "roundPlayerId no pertenece a esta ronda", invalid },
      { status: 400 },
    );
  }

  // La config de la ronda: el círculo para derivar puttsInside1PuttCircle y el radio
  // de la scoring zone para derivar los números del juego largo desde los tiros.
  const round = await prisma.round.findUnique({
    where: { id },
    select: { onePuttCircleFt: true, enterSzYds: true },
  });
  if (!round) {
    return NextResponse.json({ error: "ronda no encontrada" }, { status: 404 });
  }

  // Tiros ya registrados de los hoyos que se están guardando: si el hoyo se jugó con
  // el mapa, los números del juego largo salen de ahí y no se cargan a mano.
  const conShots = await prisma.roundHole.findMany({
    where: {
      OR: parsed.entries.map((e) => ({
        roundPlayerId: e.roundPlayerId,
        holeNumber: e.holeNumber,
      })),
      shots: { some: {} },
    },
    select: {
      roundPlayerId: true,
      holeNumber: true,
      shots: {
        orderBy: { shotNumber: "asc" },
        select: { shotNumber: true, distanceToTargetYds: true, lie: true },
      },
    },
  });
  const shotsPorHoyo = new Map(
    conShots.map((h) => [`${h.roundPlayerId}__${h.holeNumber}`, h.shots]),
  );

  // Cuando el hoyo trae las distancias por putt, esas mandan: los 4 campos legacy se
  // derivan acá y se guardan igual, para que stats / Tiger 5 / keys / resumen / el bot
  // de coach sigan leyendo lo de siempre sin enterarse del cambio. Lo mismo con los
  // tiros y los números del juego largo.
  const entries = parsed.entries.map((e) => {
    let out = e;
    if (e.puttDistancesFt != null) {
      out = { ...out, ...derivePutts(e.puttDistancesFt, round.onePuttCircleFt) };
    }
    const shots = shotsPorHoyo.get(`${e.roundPlayerId}__${e.holeNumber}`);
    if (shots?.length) {
      const sm = deriveSmFromShots(shots, out.putts ?? 0, round.enterSzYds);
      if (sm) out = { ...out, ...sm };
    }
    return out;
  });

  await prisma.$transaction(
    entries.map((e) =>
      prisma.roundHole.upsert({
        where: {
          roundPlayerId_holeNumber: {
            roundPlayerId: e.roundPlayerId,
            holeNumber: e.holeNumber,
          },
        },
        create: {
          roundId: id,
          roundPlayerId: e.roundPlayerId,
          holeNumber: e.holeNumber,
          strokesToEnterSz: e.strokesToEnterSz ?? null,
          distanceInRegYds: e.distanceInRegYds ?? null,
          strokesInsideSz: e.strokesInsideSz ?? null,
          putts: e.putts ?? null,
          firstPuttDistanceFt: e.firstPuttDistanceFt ?? null,
          puttMadeDistanceFt: e.puttMadeDistanceFt ?? null,
          puttsInside1PuttCircle: e.puttsInside1PuttCircle ?? null,
          puttDistancesFt: puttJson(e.puttDistancesFt),
          pinLat: e.pinLat ?? null,
          pinLng: e.pinLng ?? null,
          score: e.score ?? null,
          penaltyStrokes: e.penaltyStrokes ?? null,
          keysBroken: e.keysBroken ?? undefined,
          targetGoal: e.targetGoal ?? null,
          pinColor: e.pinColor ?? null,
          dangerSide: e.dangerSide ?? null,
          aimedAtCenter: e.aimedAtCenter ?? null,
          recoveryMode: e.recoveryMode ?? null,
        },
        // `undefined` = no lo toques. Antes se ponía `?? null` en todo, así que un
        // guardado parcial (por ejemplo solo la cantidad de putts) borraba el score,
        // el pin y el recovery de ese hoyo sin avisar.
        update: {
          ...(e.strokesToEnterSz !== undefined && { strokesToEnterSz: e.strokesToEnterSz }),
          ...(e.distanceInRegYds !== undefined && { distanceInRegYds: e.distanceInRegYds }),
          ...(e.strokesInsideSz !== undefined && { strokesInsideSz: e.strokesInsideSz }),
          ...(e.putts !== undefined && { putts: e.putts }),
          ...(e.firstPuttDistanceFt !== undefined && {
            firstPuttDistanceFt: e.firstPuttDistanceFt,
          }),
          ...(e.puttMadeDistanceFt !== undefined && { puttMadeDistanceFt: e.puttMadeDistanceFt }),
          ...(e.puttsInside1PuttCircle !== undefined && {
            puttsInside1PuttCircle: e.puttsInside1PuttCircle,
          }),
          ...(e.puttDistancesFt !== undefined && {
            puttDistancesFt: puttJson(e.puttDistancesFt),
          }),
          ...(e.pinLat !== undefined && { pinLat: e.pinLat }),
          ...(e.pinLng !== undefined && { pinLng: e.pinLng }),
          ...(e.score !== undefined && { score: e.score }),
          ...(e.penaltyStrokes !== undefined && { penaltyStrokes: e.penaltyStrokes }),
          ...(e.keysBroken !== undefined && { keysBroken: e.keysBroken ?? Prisma.DbNull }),
          ...(e.targetGoal !== undefined && { targetGoal: e.targetGoal }),
          ...(e.pinColor !== undefined && { pinColor: e.pinColor }),
          ...(e.dangerSide !== undefined && { dangerSide: e.dangerSide }),
          ...(e.aimedAtCenter !== undefined && { aimedAtCenter: e.aimedAtCenter }),
          ...(e.recoveryMode !== undefined && { recoveryMode: e.recoveryMode }),
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
