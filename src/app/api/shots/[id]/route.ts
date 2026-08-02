// Editar o borrar un tiro. Se usa al tocar el nodo en el mapa (cambiar palo o lie),
// al arrastrarlo (corregir dónde cayó) y desde el toast de deshacer.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { computeDeviation } from "@/lib/shot-geometry";
import { yardsBetween } from "@/lib/geo";

export const runtime = "nodejs";

const PatchSchema = z.object({
  fromLat: z.number().optional(),
  fromLng: z.number().optional(),
  targetLat: z.number().nullable().optional(),
  targetLng: z.number().nullable().optional(),
  club: z.string().max(20).nullable().optional(),
  lie: z.string().max(20).nullable().optional(),
  distanceToTargetYds: z.number().int().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());

    const shot = await prisma.roundShot.update({
      where: { id },
      data: {
        ...(body.fromLat !== undefined && { fromLat: body.fromLat }),
        ...(body.fromLng !== undefined && { fromLng: body.fromLng }),
        ...(body.targetLat !== undefined && { targetLat: body.targetLat }),
        ...(body.targetLng !== undefined && { targetLng: body.targetLng }),
        ...(body.club !== undefined && { club: body.club }),
        ...(body.lie !== undefined && { lie: body.lie }),
        ...(body.distanceToTargetYds !== undefined && {
          distanceToTargetYds: body.distanceToTargetYds,
        }),
      },
    });

    // Mover un tiro cambia DOS mediciones: dónde cayó el anterior (N−1 → N) y dónde
    // cayó él mismo (N → N+1). Recalcular las dos evita que el mapa muestre números
    // que ya no corresponden a los puntos que se ven.
    if (body.fromLat !== undefined || body.fromLng !== undefined) {
      const vecinos = await prisma.roundShot.findMany({
        where: {
          roundHoleId: shot.roundHoleId,
          shotNumber: { in: [shot.shotNumber - 1, shot.shotNumber + 1] },
        },
      });
      const prev = vecinos.find((v) => v.shotNumber === shot.shotNumber - 1);
      const next = vecinos.find((v) => v.shotNumber === shot.shotNumber + 1);

      // Cada par (origen, llegada) se recalcula igual: el origen es el tiro y la
      // llegada es la posición del siguiente.
      const pares = [
        { origen: prev, llegada: shot },
        { origen: shot, llegada: next },
      ];
      for (const { origen, llegada } of pares) {
        if (
          origen?.fromLat == null ||
          origen.fromLng == null ||
          llegada?.fromLat == null ||
          llegada.fromLng == null
        ) {
          continue;
        }
        const from = { lat: origen.fromLat, lng: origen.fromLng };
        const landed = { lat: llegada.fromLat, lng: llegada.fromLng };
        const dev =
          origen.targetLat != null && origen.targetLng != null
            ? computeDeviation(from, { lat: origen.targetLat, lng: origen.targetLng }, landed)
            : null;
        await prisma.roundShot.update({
          where: { id: origen.id },
          data: {
            shotLengthYds:
              dev?.shotLengthYds ??
              Math.round(yardsBetween(from.lat, from.lng, landed.lat, landed.lng)),
            lateralDeviationYds: dev?.lateralYds ?? null,
          },
        });
      }
    }

    return NextResponse.json({ shot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const shot = await prisma.roundShot.findUnique({
      where: { id },
      select: { roundHoleId: true, shotNumber: true },
    });
    if (!shot) return NextResponse.json({ ok: true });

    await prisma.$transaction(async (tx) => {
      await tx.roundShot.delete({ where: { id } });
      // Renumerar los que siguen: si queda un hueco, el mapa numera mal y el
      // conteo de golpes del hoyo (que sale de la cantidad de tiros) se rompe.
      const posteriores = await tx.roundShot.findMany({
        where: { roundHoleId: shot.roundHoleId, shotNumber: { gt: shot.shotNumber } },
        orderBy: { shotNumber: "asc" },
        select: { id: true },
      });
      for (let i = 0; i < posteriores.length; i++) {
        await tx.roundShot.update({
          where: { id: posteriores[i].id },
          data: { shotNumber: shot.shotNumber + i },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
