import L from "leaflet";

export type HolePoint = {
  holeNumber: number;
  teeLat: number | null;
  teeLng: number | null;
  frontLat: number | null;
  frontLng: number | null;
  centerLat: number | null;
  centerLng: number | null;
  backLat: number | null;
  backLng: number | null;
  notes: string | null;
};

// Markers + anillos de distancia desde el centro del green.
// Devuelve el array de capas creadas; el caller las añade al map y guarda
// la referencia para limpiar en el próximo render.
export function buildHoleLayers(point: HolePoint): L.Layer[] {
  const layers: L.Layer[] = [];

  if (point.teeLat != null && point.teeLng != null) {
    layers.push(
      L.marker([point.teeLat, point.teeLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:white;border:3px solid var(--fairway);box-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;">⛳</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).bindTooltip("Tee / salida", { permanent: false }),
    );
  }

  if (point.frontLat != null && point.frontLng != null) {
    layers.push(
      L.circleMarker([point.frontLat, point.frontLng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#7ed957",
        fillOpacity: 1,
      }).bindTooltip("Frente", { permanent: false }),
    );
  }
  if (point.centerLat != null && point.centerLng != null) {
    layers.push(
      L.circleMarker([point.centerLat, point.centerLng], {
        radius: 7,
        color: "#7ed957",
        weight: 2,
        fillColor: "#fff",
        fillOpacity: 1,
      }).bindTooltip("Centro", { permanent: false }),
    );
  }
  if (point.backLat != null && point.backLng != null) {
    layers.push(
      L.circleMarker([point.backLat, point.backLng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#3a86ff",
        fillOpacity: 1,
      }).bindTooltip("Fondo", { permanent: false }),
    );
  }

  // Anillos 100/150/200 yds desde el centro
  if (point.centerLat != null && point.centerLng != null) {
    const ringDefs = [
      { yds: 100, color: "#7ed957" },
      { yds: 150, color: "#ffb627" },
      { yds: 200, color: "#ff5252" },
    ];
    for (const r of ringDefs) {
      layers.push(
        L.circle([point.centerLat, point.centerLng], {
          radius: r.yds * 0.9144,
          color: r.color,
          weight: 1.5,
          fillOpacity: 0,
          opacity: 0.7,
          dashArray: "5,4",
        }),
      );
    }
  }

  return layers;
}

// Icono de label flotante (pill blanco con yardas).
// anchorOffsetX positivo = label a la derecha del lat/lng.
// anchorOffsetY positivo = label arriba; negativo = abajo.
export function makeLabelIcon(
  yds: number,
  bg: string,
  anchorOffsetX = 0,
  anchorOffsetY = 0,
): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:white;padding:3px 7px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);">${yds.toFixed(0)}y</div>`,
    iconSize: [40, 22],
    iconAnchor: [20 - anchorOffsetX, 11 + anchorOffsetY],
  });
}
