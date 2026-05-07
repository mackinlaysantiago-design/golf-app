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

// Mapeo de cada key a una "área" de mejora que la app puede recomendar.
// DECADE = decisión estratégica (apuntar al centro, evitar OB, etc)
// MENTAL = trabajo emocional/cognitivo (rutinas, foco)
// PP = drill de práctica (mapea a un drill type existente)
export type KeyArea = "PP" | "DECADE" | "MENTAL" | "TECH";

export const KEY_AREA: Record<number, { area: KeyArea; tip: string }> = {
  1: { area: "PP", tip: "Trabajá tu 1-Putt circle hasta tener 90%+ make rate" },
  2: { area: "DECADE", tip: "Bajá un palo y apuntá lejos del peligro. La regla: evitar OB > agua > obstáculos menores" },
  3: { area: "DECADE", tip: "Cuando estés en problemas: único objetivo = volver al juego. Olvidate del green" },
  4: { area: "PP", tip: "Trabajá lag putts (15-30 ft). El ritmo importa más que la lectura" },
  5: { area: "TECH", tip: "Mediste mal tu carry. Andá al range con FlightScope a recalibrar yardages" },
  6: { area: "DECADE", tip: "Apuntá al centro del green. Tus tiros 'arriesgados' rara vez compensan el costo de fallarlos" },
  7: { area: "DECADE", tip: "Apuntá al lado largo de la bandera. Short-side = chip imposible" },
  8: { area: "MENTAL", tip: "Rutina post-shot: aceptá el resultado en 10 segundos y enfocate en el próximo" },
  9: { area: "TECH", tip: "Antes del swing: leé el lie 5 segundos. Qué shot es POSIBLE desde ahí, no qué querés hacer" },
  10: { area: "MENTAL", tip: "Empezá la ronda en primera marcha. Rutina pre-ronda + warmup. No pegues drives sin preparación" },
};
