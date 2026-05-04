import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { LADDERS, type SmField } from "@/lib/sm-levels";

const Body = z.object({
  field: z.enum(["enterSzYds", "downInSzStrokes", "onePuttCircleFt", "twoPuttCircleYds"]),
  newValue: z.number().int(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { field, newValue } = Body.parse(body) as { field: SmField; newValue: number };

  // Validar que el nuevo valor esté en el ladder
  if (!LADDERS[field].includes(newValue)) {
    return NextResponse.json({ error: "valor fuera de los niveles permitidos" }, { status: 400 });
  }

  const player = await prisma.player.update({
    where: { id },
    data: { [field]: newValue },
  });
  return NextResponse.json(player);
}
