import { useEffect, useState } from "react";

export type ClubStat = {
  club: string;
  count: number;
  meanTotal: number;
  stdTotal: number;
  meanLateral: number;
  stdLateral: number;
  lastDate: string | null;
};

// Fetch on-mount. Para MVP no cachea entre cambios de hoyo (vuelve a pedir cada vez
// que se monta el componente que lo use). Si después molesta, agregar cache global.
export function useClubStats(): {
  stats: ClubStat[] | null;
  loading: boolean;
  error: string | null;
} {
  const [stats, setStats] = useState<ClubStat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/range/club-stats");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as ClubStat[];
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading, error };
}

// Etiqueta corta para el selector. DRIVER → "Driver", IRON_7 → "I7", WOOD_3 → "W3", etc.
export function clubShortLabel(club: string): string {
  if (club === "DRIVER") return "Driver";
  if (club === "PW") return "PW";
  if (club === "GW") return "GW";
  if (club === "SW") return "SW";
  if (club === "LW") return "LW";
  if (club === "PUTTER") return "Putter";
  const m = club.match(/^(IRON|WOOD|HYBRID|WEDGE)_(\d+)$/);
  if (m) {
    const map: Record<string, string> = {
      IRON: "I",
      WOOD: "W",
      HYBRID: "H",
      WEDGE: "W",
    };
    return `${map[m[1]] ?? m[1]}${m[2]}`;
  }
  return club;
}
