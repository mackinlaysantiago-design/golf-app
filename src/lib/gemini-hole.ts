// Dictado de hoyo completo por voz — mismo patrón que gemini-shot.ts (Gemini 2.5
// Flash, audio → JSON estructurado en una sola llamada), pero para los campos que
// hoy se tipean celda por celda en RondaTracker en vez de un tiro puntual.

import { GoogleGenAI } from "@google/genai";
import { SM_KEYS } from "@/lib/sm-keys";

const MODEL = "gemini-2.5-flash";

export type ParsedHole = {
  transcript: string;
  score: number | null;
  putts: number | null;
  penaltyStrokes: number | null;
  strokesToEnterSz: number | null;
  strokesInsideSz: number | null;
  distanceInRegYds: number | null;
  keysBroken: number[] | null;
  pinColor: "GREEN" | "YELLOW" | "RED" | null;
  dangerSide: "L" | "R" | "NONE" | null;
  aimedAtCenter: boolean | null;
  recoveryMode: boolean | null;
};

export type HoleContext = { holeNumber?: number; par?: number; enterSzYds?: number };

const KEYS_LIST = SM_KEYS.map((k) => `${k.id}=${k.label}`).join(", ");

const PROMPT = `Sos un asistente que carga la planilla de una ronda de golf. Recibís un audio donde
Santiago (golfista argentino, habla rioplatense y rápido) resume CÓMO LE FUE EN UN HOYO, por ejemplo:
"hoyo 9 par 4, bogey, 2 putts, entré a la scoring zone con el segundo tiro a 30 yardas del green,
sin penalidad, bandera al centro, y no rusheé nada" o simplemente "birdie, un putt".

Tu trabajo es ENTENDER y devolver SOLO este JSON (sin markdown):
{
  "transcript": "transcripción COMPLETA de lo que dijo, palabra por palabra salvo muletillas — este
    texto se guarda como el relato del hoyo, así que NO resumas ni acortes: si menciona palos
    usados, distancias intermedias, el clima, cómo le pegó a un tiro puntual o cualquier detalle
    que no entra en los campos de abajo, tiene que quedar acá",
  "score": <golpes totales del hoyo o null>,
  "putts": <cantidad de putts o null>,
  "penaltyStrokes": <golpes de penalidad (OB, agua) o null — 0 si dice explícitamente que no hubo>,
  "strokesToEnterSz": <golpes hasta ENTRAR a la scoring zone (la zona de anotación, cerca del green) o null>,
  "strokesInsideSz": <golpes DESDE que entró a la scoring zone hasta embocar, o null>,
  "distanceInRegYds": <yardas al green cuando entró a la scoring zone; 0 si dice que fue GIR (green en regulación), o null>,
  "keysBroken": <array de números 1-10 de "The 10 Keys to Scoring" que rompió ese hoyo, o null si no rompió ninguna / no lo menciona>,
  "pinColor": "GREEN (bandera al centro/fácil) | YELLOW (bandera al borde) | RED (bandera en zona trampa) | null",
  "dangerSide": "L (peligro a la izquierda) | R (peligro a la derecha) | NONE (sin peligro) | null",
  "aimedAtCenter": <true si apuntó al centro del green en vez de a la bandera, false si apuntó a la bandera, null si no lo dice>,
  "recoveryMode": <true si estuvo en problemas y jugó solo para volver al juego, null si no aplica>
}
Las 10 Keys (para mapear lo que cuenta a un id, SOLO si es clarísimo que rompió esa key — si tenés dudas, no la pongas):
${KEYS_LIST}
REGLAS CLAVE:
- Si un dato no lo menciona, poné null. NO inventes ni asumas valores típicos.
- "scoring zone" ("SZ", "zona de anotación") es la zona cerca del green donde arranca a jugar el corto juego.
- score, putts y penaltyStrokes son independientes: no los derives entre sí, tomá solo lo que dijo.`;

export async function parseHoleAudio(
  audioBytes: Buffer | Uint8Array,
  mimeType: string,
  ctx?: HoleContext,
): Promise<ParsedHole> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada");

  const client = new GoogleGenAI({ apiKey });
  const data = Buffer.isBuffer(audioBytes)
    ? audioBytes.toString("base64")
    : Buffer.from(audioBytes).toString("base64");

  const ctxParts: string[] = [];
  if (ctx?.holeNumber != null) ctxParts.push(`hoyo ${ctx.holeNumber}`);
  if (ctx?.par != null) ctxParts.push(`par ${ctx.par}`);
  if (ctx?.enterSzYds != null) ctxParts.push(`scoring zone = ${ctx.enterSzYds} yardas del green`);
  const ctxText = ctxParts.length ? `\n\nContexto: ${ctxParts.join(", ")}.` : "";

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data } }, { text: PROMPT + ctxText }],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });

  return normalizeHole(JSON.parse(response.text || "{}"));
}

function normalizeHole(raw: Partial<ParsedHole>): ParsedHole {
  return {
    transcript: raw.transcript ?? "",
    score: raw.score ?? null,
    putts: raw.putts ?? null,
    penaltyStrokes: raw.penaltyStrokes ?? null,
    strokesToEnterSz: raw.strokesToEnterSz ?? null,
    strokesInsideSz: raw.strokesInsideSz ?? null,
    distanceInRegYds: raw.distanceInRegYds ?? null,
    keysBroken: Array.isArray(raw.keysBroken) && raw.keysBroken.length ? raw.keysBroken : null,
    pinColor: raw.pinColor ?? null,
    dangerSide: raw.dangerSide ?? null,
    aimedAtCenter: raw.aimedAtCenter ?? null,
    recoveryMode: raw.recoveryMode ?? null,
  };
}
