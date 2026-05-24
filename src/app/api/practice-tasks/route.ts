import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/practice-tasks?status=PENDING — listar tasks
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const where = status ? { status } : {};
  const tasks = await prisma.practiceTask.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      round: { include: { course: true } },
      rangeSession: true,
    },
  });
  return NextResponse.json(tasks);
}

// DELETE /api/practice-tasks?status=PENDING — bulk delete por status.
// Default: solo PENDING. Acepta múltiples ?status=A&status=B.
export async function DELETE(req: NextRequest) {
  const statuses = req.nextUrl.searchParams.getAll("status");
  const valid = statuses.filter((s) => ["PENDING", "DONE", "SKIPPED"].includes(s));
  const where = valid.length > 0 ? { status: { in: valid } } : { status: "PENDING" };
  const result = await prisma.practiceTask.deleteMany({ where });
  return NextResponse.json({ ok: true, deletedCount: result.count });
}
