// F2 — Captura de un tiro por voz: recibe el audio + contexto (hoyo, GPS, distancia),
// lo manda a Gemini (parseShotAudio) y persiste el RoundShot. Devuelve lo interpretado
// para que la UI muestre la confirmación de 1 tap.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseShotAudio, parseShotsAudio } from "@/lib/gemini-shot";

export const runtime = "nodejs";
export const maxDuration = 30; // Gemini puede tardar unos segundos

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "falta el archivo 'audio'" }, { status: 400 });
    }

    const roundHoleId = (form.get("roundHoleId") as string) || null;
    const roundId = (form.get("roundId") as string) || null;
    const roundPlayerId = (form.get("roundPlayerId") as string) || null;
    const shotNumber = Number(form.get("shotNumber") ?? 0) || 1;
    const num = (k: string) => {
      const v = form.get(k);
      return v != null && v !== "" ? Number(v) : null;
    };
    const distanceToTargetYds = num("distanceToTargetYds");
    const shotLengthYds = num("shotLengthYds");
    const fromLat = num("fromLat");
    const fromLng = num("fromLng");
    const par = num("par");
    const holeNumber = num("holeNumber");
    const sgCategory = (form.get("sgCategory") as string) || null;

    const bytes = Buffer.from(await file.arrayBuffer());

    // ── Modo BATCH: un audio con varios tiros → N RoundShot ──────────────────
    if (form.get("batch") === "1") {
      let rhId = roundHoleId;
      if (!rhId && roundId && roundPlayerId && holeNumber != null) {
        const rh = await prisma.roundHole.upsert({
          where: { roundPlayerId_holeNumber: { roundPlayerId, holeNumber } },
          update: {},
          create: { roundId, roundPlayerId, holeNumber },
        });
        rhId = rh.id;
      }
      const list = await parseShotsAudio(bytes, file.type || "audio/webm");
      const created = [];
      if (rhId) {
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          created.push(
            await prisma.roundShot.create({
              data: {
                roundHoleId: rhId,
                roundId,
                roundPlayerId,
                shotNumber: shotNumber + i,
                club: p.club,
                target: p.target,
                intendedShot: p.intendedShot,
                decisionQuality: p.decisionQuality,
                decisionNote: p.decisionNote,
                executionQuality: p.executionQuality,
                result: p.result,
                voiceTranscript: p.transcript,
              },
            }),
          );
        }
      }
      return NextResponse.json({ parsedList: list, shots: created });
    }

    const parsed = await parseShotAudio(bytes, file.type || "audio/webm", {
      distanceYds: distanceToTargetYds ?? undefined,
      par: par ?? undefined,
      holeNumber: holeNumber ?? undefined,
    });

    // Resolver el RoundHole: si no vino el id, crearlo (o traerlo) para que el tiro
    // y las keys del Scoring Method queden en la MISMA fila RoundHole.
    let effectiveRoundHoleId = roundHoleId;
    if (!effectiveRoundHoleId && roundId && roundPlayerId && holeNumber != null) {
      const rh = await prisma.roundHole.upsert({
        where: { roundPlayerId_holeNumber: { roundPlayerId, holeNumber } },
        update: {},
        create: { roundId, roundPlayerId, holeNumber },
      });
      effectiveRoundHoleId = rh.id;
    }

    // Persistir solo si hay hoyo (si no, es un parse "de prueba")
    let shot = null;
    if (effectiveRoundHoleId) {
      shot = await prisma.roundShot.create({
        data: {
          roundHoleId: effectiveRoundHoleId,
          roundId,
          roundPlayerId,
          shotNumber,
          fromLat,
          fromLng,
          distanceToTargetYds,
          shotLengthYds,
          club: parsed.club,
          target: parsed.target,
          intendedShot: parsed.intendedShot,
          decisionQuality: parsed.decisionQuality,
          decisionNote: parsed.decisionNote,
          executionQuality: parsed.executionQuality,
          result: parsed.result,
          sgCategory,
          voiceTranscript: parsed.transcript,
        },
      });
    }

    return NextResponse.json({ parsed, shot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
