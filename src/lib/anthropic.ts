import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// Modelo por defecto para análisis textual
export const COACH_MODEL = "claude-sonnet-4-6";
// Modelo para Vision (FlightScope screenshots)
export const VISION_MODEL = "claude-sonnet-4-6";
