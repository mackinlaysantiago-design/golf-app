import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PatchSchema = z.object({
  date: z.string().optional(),
  club: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.parse(body);

  const data: Record<string, unknown> = {};
  if (parsed.date) data.date = new Date(parsed.date);
  if (parsed.club) data.club = parsed.club;
  if (parsed.notes !== undefined) data.notes = parsed.notes;

  const session = await prisma.rangeSession.update({ where: { id }, data });
  return NextResponse.json(session);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.rangeSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
