// Tiros de un hoyo: listar y registrar.
//
// Registrar un tiro guarda el PLAN (de dónde pegás, a dónde apuntás, con qué palo),
// no el resultado. El resultado del tiro N es la posición del tiro N+1: cuando llegás
// a la pelota y registrás el siguiente, se cierra el anterior y recién ahí se sabe
// cuánto midió y cuánto se desvió. Por eso el POST también actualiza el previo.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { computeDeviation } from "@/lib/shot-geometry";
import { yardsBetween } from "@/lib/geo";

export const runtime = "nodejs";

const SHOT_SELECT = {
  id: true,
  shotNumber: true,
  fromLat: true,
  fromLng: true,
  landedLat: true,
  landedLng: true,
  targetLat: true,
  targetLng: true,
  club: true,
  lie: true,
  penaltyType: true,
  result: true,
  distanceToTargetYds: true,
  shotLengthYds: true,
  lateralDeviationYds: true,
  gpsAccuracyM: true,
} as const;

export async function GET(req: NextRequest) {
  const roundHoleId = req.nextUrl.searchParams.get("roundHoleId");
  if (!roundHoleId) {
    return NextResponse.json({ error: "falta roundHoleId" }, { status: 400 });
  }
  const shots = await prisma.roundShot.findMany({
    where: { roundHoleId },
    orderBy: { shotNumber: "asc" },
    select: SHOT_SELECT,
  });
  return NextResponse.json({ shots });
}

const CreateSchema = z.object({
  // O ya tenés el hoyo creado, o se crea al vuelo con el jugador + número de hoyo.
  // Sin esto el primer tiro de un hoyo virgen fallaría (el RoundHole recién existe
  // cuando se guardan stats, y acá los tiros llegan antes).
  roundHoleId: z.string().optional(),
  roundPlayerId: z.string().optional(),
  holeNumber: z.number().int().min(1).max(18).optional(),
  lat: z.number(),
  lng: z.number(),
  targetLat: z.number().nullable().optional(),
  targetLng: z.number().nullable().optional(),
  club: z.string().max(20).nullable().optional(),
  lie: z.string().max(20).nullable().optional(),
  distanceToTargetYds: z.number().int().nullable().optional(),
  gpsAccuracyM: z.number().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());

    let rh: { id: string; roundId: string; roundPlayerId: string } | null = null;
    if (body.roundHoleId) {
      rh = await prisma.roundHole.findUnique({
        where: { id: body.roundHoleId },
        select: { id: true, roundId: true, roundPlayerId: true },
      });
    } else if (body.roundPlayerId && body.holeNumber != null) {
      const rp = await prisma.roundPlayer.findUnique({
        where: { id: body.roundPlayerId },
        select: { roundId: true },
      });
      if (rp) {
        rh = await prisma.roundHole.upsert({
          where: {
            roundPlayerId_holeNumber: {
              roundPlayerId: body.roundPlayerId,
              holeNumber: body.holeNumber,
            },
          },
          create: {
            roundId: rp.roundId,
            roundPlayerId: body.roundPlayerId,
            holeNumber: body.holeNumber,
          },
          update: {},
          select: { id: true, roundId: true, roundPlayerId: true },
        });
      }
    }
    if (!rh) {
      return NextResponse.json({ error: "no se pudo resolver el hoyo" }, { status: 404 });
    }

    const prev = await prisma.roundShot.findFirst({
      where: { roundHoleId: rh.id },
      orderBy: { shotNumber: "desc" },
    });

    const shot = await prisma.roundShot.create({
      data: {
        roundHoleId: rh.id,
        roundId: rh.roundId,
        roundPlayerId: rh.roundPlayerId,
        shotNumber: (prev?.shotNumber ?? 0) + 1,
        fromLat: body.lat,
        fromLng: body.lng,
        targetLat: body.targetLat ?? null,
        targetLng: body.targetLng ?? null,
        club: body.club ?? null,
        lie: body.lie ?? null,
        distanceToTargetYds: body.distanceToTargetYds ?? null,
        gpsAccuracyM: body.gpsAccuracyM ?? null,
      },
      select: SHOT_SELECT,
    });
    const roundHoleId = rh.id;

    // Cerrar el anterior: donde estás parado ahora es donde cayó.
    let closed = null;
    if (prev?.fromLat != null && prev.fromLng != null) {
      const from = { lat: prev.fromLat, lng: prev.fromLng };
      const landed = { lat: body.lat, lng: body.lng };
      const dev =
        prev.targetLat != null && prev.targetLng != null
          ? computeDeviation(from, { lat: prev.targetLat, lng: prev.targetLng }, landed)
          : null;
      closed = await prisma.roundShot.update({
        where: { id: prev.id },
        data: {
          shotLengthYds:
            dev?.shotLengthYds ??
            Math.round(yardsBetween(from.lat, from.lng, landed.lat, landed.lng)),
          lateralDeviationYds: dev?.lateralYds ?? null,
        },
        select: SHOT_SELECT,
      });
    }

    return NextResponse.json({ shot, closed, roundHoleId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
