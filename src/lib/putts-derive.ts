// Derivación de las métricas de putt a partir de la distancia de CADA putt.
//
// Desde 02/08/2026 la fuente de verdad es `RoundHole.puttDistancesFt`: un array con
// el largo de cada putt en ft, en orden (1er putt, 2do, 3ro...). Los cuatro campos
// que se cargaban a mano (putts, firstPuttDistanceFt, puttMadeDistanceFt,
// puttsInside1PuttCircle) se derivan de ahí y se siguen guardando en la DB para no
// romper stats, Tiger 5, keys, resumen ni el bot de coach — todos leen los legacy.
//
// Por qué el array y no una regla: se probaron dos reglas para inferir
// puttsInside1PuttCircle desde (putts, 1er putt, putt embocado) contra los 210 hoyos
// históricos de Santi. Con 1 o 2 putts la inferencia es exacta (188/189), pero con
// 3 putts ninguna regla pasó del 63% — la distancia del putt del medio no está en
// ningún lado. Cargando cada putt no queda nada que inferir.

export type PuttsDerived = {
  putts: number;
  firstPuttDistanceFt: number | null;
  puttMadeDistanceFt: number | null;
  puttsInside1PuttCircle: number;
};

/**
 * Normaliza el valor crudo de `puttDistancesFt` (viene de un campo Json de Prisma).
 * Devuelve null si no es un array usable — el caller cae a los campos legacy.
 */
export function parsePuttDistances(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  for (const v of raw) {
    // Estricto a propósito: Number(null) da 0 y Number(true) da 1, así que un array
    // con basura pasaría por válido y derivaríamos putts inventados. Mejor caer al legacy.
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    out.push(Math.round(v));
  }
  return out;
}

/**
 * Deriva las 4 métricas desde las distancias por putt.
 *
 * Convención de borde: un putt a la distancia EXACTA del círculo cuenta como adentro
 * (`<=`). El círculo es el radio dentro del cual esperás embocar, así que el borde
 * entra. Está en un solo lugar por si hay que cambiarlo.
 */
export function derivePutts(distancesFt: number[], onePuttCircleFt: number): PuttsDerived {
  const putts = distancesFt.length;
  return {
    putts,
    firstPuttDistanceFt: putts > 0 ? distancesFt[0] : null,
    puttMadeDistanceFt: putts > 0 ? distancesFt[putts - 1] : null,
    puttsInside1PuttCircle: distancesFt.filter((d) => d <= onePuttCircleFt).length,
  };
}

// Los hoyos viejos (array null) se siguen leyendo de los campos legacy tal cual: el
// server escribe los derivados en esos mismos campos, así que ningún lector necesita
// saber de dónde salieron. No hace falta un helper de lectura.
