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
    label: "Putts Cortos Errados",
    short: "Putts Cortos Errados",
    solution: "Practicá desde tu 1-Putt circle",
    ppCode: "1",
  },
  {
    id: 2,
    label: "Multas",
    short: "Multas",
    solution: "Jugá conservador, evitá problemas",
    ppCode: null,
  },
  {
    id: 3,
    label: "No salir del problema",
    short: "No salir del problema",
    solution: "Tirá el shot seguro para volver al juego",
    ppCode: null,
  },
  {
    id: 4,
    label: "3 putts",
    short: "3 putts",
    solution: "Lag putts: trabajá el ritmo, no la lectura",
    ppCode: "2",
  },
  {
    id: 5,
    label: "Palo Corto",
    short: "Palo Corto",
    solution: "Aprendé tu carry yardage en el range",
    ppCode: null,
  },
  {
    id: 6,
    label: "Jugar Tiros Riesgoso",
    short: "Jugar Tiros Riesgoso",
    solution: "Jugá dentro de tu zona de confort",
    ppCode: null,
  },
  {
    id: 7,
    label: "Short siding",
    short: "Short siding",
    solution: "Jugá al lado largo de la bandera",
    ppCode: null,
  },
  {
    id: 8,
    label: "Enganchado a mal tiro",
    short: "Enganchado a mal tiro",
    solution: "Olvidá el último tiro, foco en el próximo",
    ppCode: null,
  },
  {
    id: 9,
    label: "Mala lectura de lie",
    short: "Mala lectura de lie",
    solution: "Aprendé qué tiro es posible desde tu lie",
    ppCode: null,
  },
  {
    id: 10,
    label: "Arrancar mal",
    short: "Arrancar mal",
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
