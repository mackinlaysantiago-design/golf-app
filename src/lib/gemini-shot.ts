// F2.3 — Transcripción + parseo de un tiro por voz con Gemini 2.5 Flash.
// Patrón robado de kine-bot/web/lib/gemini.ts: audio base64 → generateContent con
// inlineData + responseMimeType JSON → objeto estructurado. UNA llamada = transcribe + entiende.
// Cloud pero free tier; usa la key GOOGLE_GENERATIVE_AI_API_KEY (la misma del kine-bot / gemini-review).

import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";

export type ParsedShot = {
  transcript: string;
  club: string | null;
  target: string | null;
  intendedShot: string | null; // FADE | DRAW | PUNCH | STOCK
  decisionQuality: "GOOD" | "BAD" | null;
  decisionNote: string | null;
  executionQuality: string | null; // FLUSH | THIN | FAT | PULL | PUSH | SHORT | LONG | OK
  result: string | null; // FAIRWAY | FAIRWAY_IZQ | GREEN | ROUGH | BUNKER | WATER | OB | HOLED | SHORT_GREEN ...
};

export type ShotContext = { distanceYds?: number; par?: number; holeNumber?: number };

const PROMPT = `Sos un asistente que registra tiros de golf. Recibís un audio donde Santiago (golfista
argentino) describe RÁPIDO un tiro que acaba de pegar, con habla rioplatense y muletillas.
Tu trabajo NO es transcribir literal: es ENTENDER el tiro y devolver SOLO este JSON (sin markdown):
{
  "transcript": "lo que dijo, limpio y breve",
  "club": "Driver | 3W | 4i | 5i | 6i | 7i | 8i | 9i | PW | 52 | Wedge | Putter | null",
  "target": "centro | bandera | layup | lado largo | ... | null",
  "intendedShot": "FADE | DRAW | PUNCH | STOCK | null",
  "decisionQuality": "GOOD | BAD | null",
  "decisionNote": "por qué la decisión fue buena/mala, breve, o null",
  "executionQuality": "FLUSH | THIN | FAT | PULL | PUSH | SHORT | LONG | OK | null",
  "result": "FAIRWAY | FAIRWAY_IZQ | FAIRWAY_DER | GREEN | ROUGH | BUNKER | WATER | OB | HOLED | SHORT_GREEN | null"
}
REGLAS CLAVE:
- decisionQuality (¿eligió bien el palo/target?) y executionQuality (¿le pegó bien?) son COSAS DISTINTAS:
  se puede decidir bien y pegar mal, o al revés. No las mezcles.
- Si un dato no lo menciona, poné null. NO inventes.`;

export async function parseShotAudio(
  audioBytes: Buffer | Uint8Array,
  mimeType: string,
  ctx?: ShotContext,
): Promise<ParsedShot> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada");

  const client = new GoogleGenAI({ apiKey });
  const data = Buffer.isBuffer(audioBytes)
    ? audioBytes.toString("base64")
    : Buffer.from(audioBytes).toString("base64");

  const ctxText = ctx?.distanceYds
    ? `\n\nContexto GPS: le quedaban ~${ctx.distanceYds} yardas al centro del green${
        ctx.par ? ` (hoyo par ${ctx.par})` : ""
      }.`
    : "";

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

  return normalizeShot(JSON.parse(response.text || "{}"));
}

function normalizeShot(raw: Partial<ParsedShot>): ParsedShot {
  return {
    transcript: raw.transcript ?? "",
    club: raw.club ?? null,
    target: raw.target ?? null,
    intendedShot: raw.intendedShot ?? null,
    decisionQuality: raw.decisionQuality ?? null,
    decisionNote: raw.decisionNote ?? null,
    executionQuality: raw.executionQuality ?? null,
    result: raw.result ?? null,
  };
}

const BATCH_PROMPT = `Recibís un audio donde Santiago (golfista argentino) describe VARIOS tiros de un
mismo hoyo, en orden (ej: "driver al fairway tirando a la izquierda, después 7 hierro al centro que
quedó corto, y dos putts para el bogey"). Separalos y devolvé SOLO este JSON (sin markdown):
{ "shots": [ <un objeto por CADA tiro, en orden> ] }
Cada objeto con el formato:
{"transcript":"...","club":"Driver|3W|4i|5i|6i|7i|8i|9i|PW|52|Wedge|Putter|null",
 "target":"centro|bandera|layup|...|null","intendedShot":"FADE|DRAW|PUNCH|STOCK|null",
 "decisionQuality":"GOOD|BAD|null","decisionNote":"...|null",
 "executionQuality":"FLUSH|THIN|FAT|PULL|PUSH|SHORT|LONG|OK|null",
 "result":"FAIRWAY|FAIRWAY_IZQ|FAIRWAY_DER|GREEN|ROUGH|BUNKER|WATER|OB|HOLED|SHORT_GREEN|null"}
Los putts contan como tiros (club "Putter"). decisionQuality y executionQuality son distintas. Null si no lo dice.`;

// Batch: un audio con varios tiros → array de ParsedShot (en orden).
export async function parseShotsAudio(
  audioBytes: Buffer | Uint8Array,
  mimeType: string,
): Promise<ParsedShot[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada");
  const client = new GoogleGenAI({ apiKey });
  const data = Buffer.isBuffer(audioBytes)
    ? audioBytes.toString("base64")
    : Buffer.from(audioBytes).toString("base64");
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }, { text: BATCH_PROMPT }] }],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });
  const raw = JSON.parse(response.text || "{}");
  const arr: Partial<ParsedShot>[] = Array.isArray(raw) ? raw : raw.shots ?? [];
  return arr.map(normalizeShot);
}
