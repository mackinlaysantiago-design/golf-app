import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
  playerId: z.string(),
  type: z.enum(["BELIEF", "SELF_TALK", "EMOTION", "STORY"]),
  context: z.enum(["ROUND", "PRACTICE", "GENERAL"]).nullable().optional(),
  contextId: z.string().nullable().optional(),
  content: z.string().min(1),
  positive: z.boolean().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Body.parse(body);
  const note = await prisma.mentalNote.create({
    data: {
      playerId: parsed.playerId,
      type: parsed.type,
      context: parsed.context ?? null,
      contextId: parsed.contextId ?? null,
      content: parsed.content,
      positive: parsed.positive ?? null,
    },
  });
  return NextResponse.json(note, { status: 201 });
}

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  const type = req.nextUrl.searchParams.get("type");
  const where: Record<string, unknown> = {};
  if (playerId) where.playerId = playerId;
  if (type) where.type = type;
  const notes = await prisma.mentalNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(notes);
}
