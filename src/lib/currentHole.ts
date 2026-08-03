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


// Pelota puesta a mano, por ronda y hoyo. No va a la base porque todavía no es un
// dato: la posición de la pelota se vuelve real recién cuando registrás el próximo
// tiro. Pero tiene que sobrevivir a salir de la pantalla y volver — si no, corrés la
// pelota, vas a la hoja de datos y al volver está de nuevo donde estaba.
const BOLA_KEY = (roundId: string, hole: number) => `gf-round-${roundId}-h${hole}-bola`;

export function readBolaManual(roundId: string, hole: number): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BOLA_KEY(roundId, hole));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { lat: number; lng: number };
    // Number.isFinite y no typeof: NaN es "number" y un NaN persistido rompería el mapa.
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? v : null;
  } catch {
    return null;
  }
}

export function writeBolaManual(
  roundId: string,
  hole: number,
  pos: { lat: number; lng: number } | null,
): void {
  if (typeof window === "undefined") return;
  if (pos) localStorage.setItem(BOLA_KEY(roundId, hole), JSON.stringify(pos));
  else localStorage.removeItem(BOLA_KEY(roundId, hole));
}
