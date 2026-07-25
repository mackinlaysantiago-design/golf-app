// Actualiza la ubicación (o campos) de un tiro. Usado para arrastrar el marker en el mapa.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      fromLat?: number;
      fromLng?: number;
      distanceToTargetYds?: number;
    };
    const data: { fromLat?: number; fromLng?: number; distanceToTargetYds?: number } = {};
    if (typeof body.fromLat === "number") data.fromLat = body.fromLat;
    if (typeof body.fromLng === "number") data.fromLng = body.fromLng;
    if (typeof body.distanceToTargetYds === "number") data.distanceToTargetYds = body.distanceToTargetYds;
    const shot = await prisma.roundShot.update({ where: { id }, data });
    return NextResponse.json({ shot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.roundShot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
