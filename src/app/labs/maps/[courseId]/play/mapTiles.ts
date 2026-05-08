import L from "leaflet";

// Setup de la capa satelital. Prioridad: Google Tile API > Mapbox > ESRI.
// Google requiere session token (POST createSession). Si falla cae a Mapbox/ESRI.
// `cancelledRef` evita race condition si el componente se desmonta antes de
// resolver el fetch a createSession.
export async function attachSatelliteLayer(
  map: L.Map,
  cancelledRef: { current: boolean },
): Promise<void> {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (googleKey && (await tryGoogleLayer(map, googleKey, cancelledRef))) return;
  if (cancelledRef.current) return;

  if (mapboxToken) {
    L.tileLayer(
      `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${mapboxToken}`,
      { maxZoom: 22, maxNativeZoom: 19, attribution: "© Mapbox © Maxar" },
    ).addTo(map);
    return;
  }

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 18, attribution: "Esri, Maxar, Earthstar Geographics" },
  ).addTo(map);
}

async function tryGoogleLayer(
  map: L.Map,
  apiKey: string,
  cancelledRef: { current: boolean },
): Promise<boolean> {
  try {
    const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapType: "satellite",
        language: "es-AR",
        region: "AR",
        highDpi: true,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { session?: string };
    if (cancelledRef.current || !data.session) return false;
    L.tileLayer(
      `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${data.session}&key=${apiKey}`,
      { maxZoom: 22, maxNativeZoom: 22, attribution: "© Google" },
    ).addTo(map);
    return true;
  } catch {
    return false;
  }
}
