import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada");
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export const COACH_MODEL = "gemini-2.5-flash";
export const VISION_MODEL = "gemini-2.5-flash";
