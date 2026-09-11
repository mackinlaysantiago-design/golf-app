// Dictado de hoyo completo por voz: transcribe + interpreta con Gemini y devuelve
// los campos parseados SIN persistir — la UI los muestra editables y el guardado
// real viaja por el PUT /api/rondas/[id]/hoyos que ya existe (misma validación,
// mismo mecanismo de derivación desde tiros si el hoyo también tiene GPS).
import { NextRequest, NextResponse } from "next/server";
import { parseHoleAudio } from "@/lib/gemini-hole";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "falta el archivo 'audio'" }, { status: 400 });
    }

    const num = (k: string) => {
      const v = form.get(k);
      return v != null && v !== "" ? Number(v) : undefined;
    };

    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseHoleAudio(bytes, file.type || "audio/webm", {
      holeNumber: num("holeNumber"),
      par: num("par"),
      enterSzYds: num("enterSzYds"),
    });

    return NextResponse.json({ parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
