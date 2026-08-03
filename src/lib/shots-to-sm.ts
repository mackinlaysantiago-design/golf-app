// Derivar los números del Scoring Method desde la secuencia de tiros.
//
// La idea de fondo del rediseño: capturar EVENTOS (un tiro: de dónde, con qué palo,
// a dónde apuntabas) y calcular las MÉTRICAS, en vez de pedir las métricas a mano.
// Con eventos, cualquier métrica nueva del método se calcula sin tocar la carga.
//
// Los putts NO se derivan de los tiros: el GPS del teléfono tiene 3-5 m de error y a
// dos pasos del hoyo eso es más grande que el putt. Los putts se cargan en pasos
// (ver lib/putts-derive.ts) y entran acá como cantidad.

export type ShotForSm = {
  shotNumber: number;
  /** Distancia al target en el momento de pegar (GPS). */
  distanceToTargetYds: number | null;
  /** Dónde terminó el tiro. "Penalización" cuenta golpe de castigo. */
  lie: string | null;
};

export type SmDerived = {
  score: number;
  strokesToEnterSz: number;
  strokesInsideSz: number;
  distanceInRegYds: number | null;
  penaltyStrokes: number;
};

const LIE_PENALIDAD = "Penalización";

/**
 * @param shots  tiros del hoyo (de tee a green), ordenados
 * @param puttCount  cantidad de putts cargados a mano
 * @param enterSzYds  radio de la scoring zone configurado en la ronda
 *
 * Devuelve null si no hay tiros: sin eventos no hay nada que derivar y el hoyo se
 * sigue cargando a mano.
 */
export function deriveSmFromShots(
  shots: ShotForSm[],
  puttCount: number,
  enterSzYds: number,
): SmDerived | null {
  if (shots.length === 0) return null;

  const ordenados = [...shots].sort((a, b) => a.shotNumber - b.shotNumber);
  const penaltyStrokes = ordenados.filter((s) => s.lie === LIE_PENALIDAD).length;
  const score = ordenados.length + puttCount + penaltyStrokes;

  // Primer tiro pegado ya desde ADENTRO de la zona. Un tiro sin distancia (GPS que no
  // fijó) se toma como afuera: es lo más probable y no inventa un dato mejor del que hay.
  const iAdentro = ordenados.findIndex(
    (s) => s.distanceToTargetYds != null && s.distanceToTargetYds <= enterSzYds,
  );

  // Golpes que te llevó ENTRAR a la zona: los que pegaste antes del primero de adentro,
  // más las penalidades de ese tramo. NO es "todos los tiros pegados desde afuera": si
  // entrás a la zona y después la sacás afuera con un chunk, ese tiro no cuenta para
  // entrar — ya habías entrado. Contarlo inflaba el número y bajaba Inside SZ.
  const antesDeEntrar = iAdentro >= 0 ? ordenados.slice(0, iAdentro) : ordenados;
  const strokesToEnterSz =
    antesDeEntrar.length + antesDeEntrar.filter((s) => s.lie === LIE_PENALIDAD).length;

  // distanceInRegYds = distancia al hoyo cuando entraste a la scoring zone, con la
  // convención que Santi viene usando hace 15 rondas: **0 significa que llegaste al
  // green** (es lo que las stats cuentan como GIR). Verificado contra prod: de los 90
  // hoyos cargados con 0, en 84 strokesInsideSz == putts, o sea adentro solo putteó.
  //
  // Entonces: si algún tiro se pegó ya desde adentro de la zona, esa es la distancia.
  // Si no hubo ninguno, entraste llegando al green → 0.
  const primeroAdentro = iAdentro >= 0 ? ordenados[iAdentro] : undefined;
  const ultimo = ordenados[ordenados.length - 1];
  const llegoAlGreen = ultimo.lie === "Green" || ultimo.lie === "En el hoyo";
  const distanceInRegYds = primeroAdentro
    ? primeroAdentro.distanceToTargetYds
    : llegoAlGreen
      ? 0
      : null; // no llegó al green y no pegó desde adentro: no se sabe, mejor null

  return {
    score,
    strokesToEnterSz,
    strokesInsideSz: score - strokesToEnterSz,
    distanceInRegYds,
    penaltyStrokes,
  };
}
