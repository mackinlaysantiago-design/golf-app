// Puente Shot-Tracker → Scoring Method: deriva las keys (1-10) rotas en un hoyo
// a partir de los tiros capturados por voz. Así el tracker NO reemplaza al método:
// lo ALIMENTA. Los tiros por voz siguen produciendo los mismos indicadores.
//
// Algunas keys se infieren con confianza desde el tiro; otras (K3 recovery, K7 short-side,
// K8/K9/K10 mentales) necesitan más contexto y se siguen marcando por otros medios.

export type ShotForKeys = {
  sgCategory?: string | null; // TEE | APPROACH | SHORT | PUTT
  club?: string | null;
  decisionQuality?: string | null; // GOOD | BAD
  executionQuality?: string | null; // FLUSH | THIN | FAT | PULL | PUSH | SHORT | LONG | OK
  result?: string | null; // FAIRWAY | GREEN | WATER | OB | SHORT_GREEN | ...
};

function isPutt(s: ShotForKeys): boolean {
  return s.sgCategory === "PUTT" || (s.club ?? "").toLowerCase().includes("putter");
}

/** Keys del Scoring Method inferibles desde los tiros de UN hoyo. Devuelve nºs 1-10 únicos. */
export function deriveKeysForHole(shots: ShotForKeys[]): number[] {
  const keys = new Set<number>();
  const putts = shots.filter(isPutt);

  // K4 — 3 putts (o más)
  if (putts.length >= 3) keys.add(4);

  // K2 — Multas: alguna pelota al agua u OB
  if (shots.some((s) => s.result === "WATER" || s.result === "OB")) keys.add(2);

  // K6 — Tiros Riesgosos: una decisión marcada como mala (apuntó a algo que no debía)
  if (shots.some((s) => s.decisionQuality === "BAD")) keys.add(6);

  // K5 — Palo Corto: approach que quedó corto del green por distancia/palo (no por mal contacto)
  if (
    shots.some(
      (s) =>
        s.sgCategory === "APPROACH" &&
        s.decisionQuality !== "BAD" &&
        (s.result === "SHORT_GREEN" || s.executionQuality === "SHORT"),
    )
  ) {
    keys.add(5);
  }

  return Array.from(keys).sort((a, b) => a - b);
}
