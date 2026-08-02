// Persistencia local del hoyo actual de una ronda. Compartido entre
// el tracker de cards (/rondas/[id]?vista=cards) y el mapa (/rondas/[id]/mapa).

const KEY = (roundId: string) => `gf-round-${roundId}-current-hole`;

export function readCurrentHole(roundId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY(roundId));
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1 || n > 18) return null;
  return n;
}

export function writeCurrentHole(roundId: string, hole: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(roundId), String(hole));
}
