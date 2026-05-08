import { useEffect, useState } from "react";

type Wind = { speed: number; direction: number };

// Open-Meteo: gratis, sin API key. Refresh cada 10 min mientras esté habilitado.
export function useWind(
  enabled: boolean,
  lat: number | null,
  lng: number | null,
): Wind | null {
  const [wind, setWind] = useState<Wind | null>(null);

  useEffect(() => {
    if (!enabled || lat == null || lng == null) {
      setWind(null);
      return;
    }
    let cancelled = false;
    const fetchWind = async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&windspeed_unit=kmh`,
        );
        if (!r.ok) return;
        const d = (await r.json()) as {
          current_weather?: { windspeed: number; winddirection: number };
        };
        if (cancelled || !d.current_weather) return;
        setWind({
          speed: d.current_weather.windspeed,
          direction: d.current_weather.winddirection,
        });
      } catch {
        // noop
      }
    };
    fetchWind();
    const id = setInterval(fetchWind, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, lat, lng]);

  return wind;
}
