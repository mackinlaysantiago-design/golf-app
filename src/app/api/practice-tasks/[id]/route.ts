import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PatchSchema = z.object({
  status: z.enum(["PENDING", "DONE", "SKIPPED"]).optional(),
  timesCompleted: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.parse(body);
  const data: Record<string, unknown> = {};
  if (parsed.status) {
    data.status = parsed.status;
    data.doneAt = parsed.status === "DONE" ? new Date() : null;
  }
  if (parsed.timesCompleted != null) {
    data.timesCompleted = parsed.timesCompleted;
  }
  const task = await prisma.practiceTask.update({ where: { id }, data });
  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.practiceTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
