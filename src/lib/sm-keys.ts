// The Scoring Method — 10 Keys to Scoring (Will Robins)
// Cada hoyo, el jugador marca qué keys "rompió". Al final del round se hace
// tally y las top 2 más rotas → solutions/practice.

export type SmKey = {
  id: number; // 1..10
  label: string;
  short: string;       // label corto para chips
  solution: string;    // solution textual del PDF
  ppCode?: "1" | "2" | "A" | "B" | null; // mapeo a drill PP existente (cuando aplica)
};

export const SM_KEYS: SmKey[] = [
  {
    id: 1,
    label: "Missed short putts",
    short: "Putts cortos",
    solution: "Practicá desde tu 1-Putt circle",
    ppCode: "1",
  },
  {
    id: 2,
    label: "Penalty strokes",
    short: "Penalidades",
    solution: "Jugá conservador, evitá problemas",
    ppCode: null,
  },
  {
    id: 3,
    label: "Not getting out of trouble",
    short: "Salir del problema",
    solution: "Tirá el shot seguro para volver al juego",
    ppCode: null,
  },
  {
    id: 4,
    label: "Three putts",
    short: "3-putts",
    solution: "Lag putts: trabajá el ritmo, no la lectura",
    ppCode: "2",
  },
  {
    id: 5,
    label: "Under clubbing",
    short: "Te quedaste corto",
    solution: "Aprendé tu carry yardage en el range",
    ppCode: null,
  },
  {
    id: 6,
    label: "Playing risky shots",
    short: "Tiros riesgosos",
    solution: "Jugá dentro de tu zona de confort",
    ppCode: null,
  },
  {
    id: 7,
    label: "Short-siding",
    short: "Short side",
    solution: "Jugá al lado largo de la bandera",
    ppCode: null,
  },
  {
    id: 8,
    label: "Holding onto bad shots",
    short: "Cargado del tiro malo",
    solution: "Olvidá el último tiro, foco en el próximo",
    ppCode: null,
  },
  {
    id: 9,
    label: "Misreading the lie",
    short: "Mala lectura del lie",
    solution: "Aprendé qué tiro es posible desde tu lie",
    ppCode: null,
  },
  {
    id: 10,
    label: "Starting poorly",
    short: "Mal arranque",
    solution: "Empezá en primera marcha",
    ppCode: null,
  },
];

export const KEY_BY_ID: Record<number, SmKey> = Object.fromEntries(
  SM_KEYS.map((k) => [k.id, k]),
);

// Tally: array de arrays (por hoyo) → counts por keyId
export function tallyKeys(holesKeysBroken: (number[] | null | undefined)[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const k of SM_KEYS) counts[k.id] = 0;
  for (const arr of holesKeysBroken) {
    if (!arr) continue;
    for (const id of arr) {
      if (counts[id] != null) counts[id]++;
    }
  }
  return counts;
}

// Top N keys más rotas (sólo las que tienen count > 0)
export function topKeys(counts: Record<number, number>, n: number = 2): { key: SmKey; count: number }[] {
  return Object.entries(counts)
    .map(([id, count]) => ({ key: KEY_BY_ID[parseInt(id)], count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
