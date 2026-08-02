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
      commitmentScore: z.number().int().min(1).max(10).nullable().optional(),
      emotionPlayed: z.string().nullable().optional(),
      problemArea: z.enum(["LONG_GAME", "SHORT_GAME", "BOTH", "UNSURE"]).nullable().optional(),
      emotionalStateBefore: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  ayudas: z
    .object({
      clubSuggestion: z.boolean().optional(),
      windEnabled: z.boolean().optional(),
      tournamentMode: z.boolean().optional(),
    })
    .optional(),
  format: z
    .object({
      holesPlayed: z.union([z.literal(9), z.literal(18)]).optional(),
      nineWhich: z.enum(["IDA", "VUELTA"]).nullable().optional(),
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

  // Modo torneo: una vez que la ronda arrancó así, NO se puede desactivar ni prender
  // una ayuda ilegal. El chequeo va en el server porque es lo único que el jugador no
  // puede saltear — y acá lo que está en juego es una descalificación (Regla 4.3a).
  let ayudasFinal: {
    tournamentMode?: boolean;
    clubSuggestion?: boolean;
    windEnabled?: boolean;
  } | null = null;

  if (parsed.ayudas) {
    const actual = await prisma.round.findUnique({
      where: { id },
      select: { tournamentMode: true },
    });
    if (!actual) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }
    if (actual.tournamentMode) {
      const intenta =
        parsed.ayudas.tournamentMode === false ||
        parsed.ayudas.clubSuggestion === true ||
        parsed.ayudas.windEnabled === true;
      if (intenta) {
        return NextResponse.json(
          {
            error:
              "La ronda arrancó en modo torneo: no se puede desactivar ni habilitar ayudas prohibidas por la Regla 4.3a.",
          },
          { status: 409 },
        );
      }
    }

    // Se resuelve acá, no con spreads dentro del `data`: mandando
    // { tournamentMode: true, clubSuggestion: true } en el mismo payload, el orden de
    // las propiedades dejaba el torneo prendido CON la ayuda ilegal habilitada.
    const torneo = parsed.ayudas.tournamentMode ?? actual.tournamentMode;
    ayudasFinal = {
      ...(parsed.ayudas.tournamentMode !== undefined && { tournamentMode: torneo }),
      // En torneo las ilegales van a false, sin importar qué pida el cliente.
      ...(torneo
        ? { clubSuggestion: false, windEnabled: false }
        : {
            ...(parsed.ayudas.clubSuggestion !== undefined && {
              clubSuggestion: parsed.ayudas.clubSuggestion,
            }),
            ...(parsed.ayudas.windEnabled !== undefined && {
              windEnabled: parsed.ayudas.windEnabled,
            }),
          }),
    };
  }

  await prisma.$transaction(async (tx) => {
    if (ayudasFinal) {
      await tx.round.update({ where: { id }, data: ayudasFinal });
    }
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

    if (parsed.format) {
      const data: Record<string, unknown> = {};
      if (parsed.format.holesPlayed !== undefined) data.holesPlayed = parsed.format.holesPlayed;
      if (parsed.format.nineWhich !== undefined) data.nineWhich = parsed.format.nineWhich;
      if (Object.keys(data).length > 0) {
        await tx.round.update({ where: { id }, data });
      }
    }

    if (parsed.reflexion) {
      const data: Record<string, unknown> = {};
      if (parsed.reflexion.bestParts !== undefined) data.bestParts = parsed.reflexion.bestParts ?? null;
      if (parsed.reflexion.bestShot !== undefined) data.bestShot = parsed.reflexion.bestShot ?? null;
      if (parsed.reflexion.commitmentScore !== undefined) data.commitmentScore = parsed.reflexion.commitmentScore ?? null;
      if (parsed.reflexion.emotionPlayed !== undefined) data.emotionPlayed = parsed.reflexion.emotionPlayed ?? null;
      if (Object.keys(data).length > 0) {
        await tx.round.update({ where: { id }, data });
      }
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
