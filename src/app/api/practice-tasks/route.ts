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
