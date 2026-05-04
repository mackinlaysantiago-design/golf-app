import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PatchSchema = z.object({
  players: z
    .array(
      z.object({
        id: z.string(),
        hcpIndex: z.number().nullable().optional(),
        courseHcp: z.number().int().nullable().optional(),
        modalityHcps: z.record(z.string(), z.number().nullable()).nullable().optional(),
      }),
    )
    .optional(),
  bets: z
    .array(
      z.object({
        modality: z.string(),
        amount: z.number().nonnegative(),
        currency: z.string().default("ARS"),
      }),
    )
    .optional(),
  reflexion: z
    .object({
      bestParts: z.string().nullable().optional(),
      bestShot: z.string().nullable().optional(),
    })
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.parse(body);

  await prisma.$transaction(async (tx) => {
    if (parsed.players) {
      for (const p of parsed.players) {
        // Validar que el roundPlayer pertenezca a esta ronda
        const rp = await tx.roundPlayer.findFirst({
          where: { id: p.id, roundId: id },
        });
        if (!rp) continue;
        // Limpiar nulls dentro de modalityHcps
        const cleanHcps = p.modalityHcps
          ? Object.fromEntries(
              Object.entries(p.modalityHcps).filter(([, v]) => v !== null && v !== undefined),
            )
          : undefined;
        await tx.roundPlayer.update({
          where: { id: p.id },
          data: {
            hcpIndex: p.hcpIndex !== undefined ? p.hcpIndex : undefined,
            courseHcp: p.courseHcp !== undefined ? p.courseHcp : undefined,
            modalityHcps: cleanHcps !== undefined ? cleanHcps : undefined,
          },
        });
      }
    }

    if (parsed.reflexion) {
      await tx.round.update({
        where: { id },
        data: {
          bestParts: parsed.reflexion.bestParts ?? null,
          bestShot: parsed.reflexion.bestShot ?? null,
        },
      });
    }

    if (parsed.bets) {
      // Borrar todas las bets actuales y reemplazar con las nuevas
      await tx.roundBet.deleteMany({ where: { roundId: id } });
      if (parsed.bets.length > 0) {
        await tx.roundBet.createMany({
          data: parsed.bets.map((b) => ({
            roundId: id,
            modality: b.modality,
            amount: b.amount,
            currency: b.currency ?? "ARS",
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
    },
  });
  if (!round) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(round);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.round.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
