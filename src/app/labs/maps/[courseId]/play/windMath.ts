// Cardinales: dado un ángulo en grados (0-360) devuelve N/NE/E/SE/S/SO/O/NO.
export function cardinalFromDeg(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

// Bearing: rumbo en grados desde norte entre 2 lat/lng.
export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const x = Math.sin(dLambda) * Math.cos(phi2);
  const y =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

// Componentes head/tail/cross relativos a un rumbo de tiro.
// `windDirection` = de DÓNDE viene el viento (convención meteorológica).
// `head > 0` = en contra; `head < 0` = a favor.
// `crossSide`: izq significa que el viento viene desde la izquierda del jugador.
export function windComponents(
  windDirection: number,
  windSpeed: number,
  shotBearing: number,
): { head: number; cross: number; crossSide: "izq" | "der" } {
  const windTo = (windDirection + 180) % 360;
  const diffDeg = ((windTo - shotBearing + 540) % 360) - 180;
  const rad = (diffDeg * Math.PI) / 180;
  const tailComp = windSpeed * Math.cos(rad);
  const crossComp = windSpeed * Math.sin(rad);
  return {
    head: -tailComp,
    cross: Math.abs(crossComp),
    crossSide: crossComp >= 0 ? "izq" : "der",
  };
}
