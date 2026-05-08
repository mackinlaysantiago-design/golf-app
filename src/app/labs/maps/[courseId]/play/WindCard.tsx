"use client";

import { bearingDeg, cardinalFromDeg, windComponents } from "./windMath";

type Wind = { speed: number; direction: number };

export function WindCard({
  enabled,
  wind,
  userLat,
  userLng,
  greenLat,
  greenLng,
  tournamentMode,
  onToggle,
}: {
  enabled: boolean;
  wind: Wind | null;
  userLat: number | null;
  userLng: number | null;
  greenLat: number | null;
  greenLng: number | null;
  tournamentMode: boolean;
  onToggle: () => void;
}) {
  if (tournamentMode) {
    return (
      <div className="text-[10px] gf-mono text-[var(--muted)] text-center py-1">
        🌬️ Viento bloqueado en modo torneo
      </div>
    );
  }
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="text-[10px] gf-mono text-[var(--muted)] underline w-full text-center py-1"
      >
        🌬️ Activar viento (no usar en torneo)
      </button>
    );
  }
  if (!wind) {
    return (
      <div
        className="flex items-center justify-between gap-2 text-[10px] gf-mono p-2 rounded"
        style={{ background: "var(--green-pale)" }}
      >
        <span className="text-[var(--muted)]">🌬️ Cargando viento...</span>
        <button onClick={onToggle} className="underline text-[var(--muted)]">
          desactivar
        </button>
      </div>
    );
  }

  const fromCardinal = cardinalFromDeg(wind.direction);
  const hasShotLine =
    userLat != null && userLng != null && greenLat != null && greenLng != null;
  const components = hasShotLine
    ? windComponents(
        wind.direction,
        wind.speed,
        bearingDeg(userLat!, userLng!, greenLat!, greenLng!),
      )
    : null;

  return (
    <div
      className="text-[11px] gf-mono p-2 rounded flex items-center gap-3"
      style={{ background: "var(--green-pale)" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--fairway)",
          color: "white",
          flexShrink: 0,
        }}
        title={`Viene del ${fromCardinal}`}
      >
        <span
          style={{
            display: "inline-block",
            transform: `rotate(${(wind.direction + 180) % 360}deg)`,
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label={`viento ${fromCardinal}`}
        >
          ↑
        </span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline">
          <span className="font-bold">
            {wind.speed.toFixed(0)} km/h del {fromCardinal}
          </span>
          <button
            onClick={onToggle}
            className="text-[9px] underline text-[var(--muted)]"
          >
            apagar
          </button>
        </div>
        {components ? (
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            {Math.abs(components.head) < 1
              ? "sin viento longitudinal"
              : components.head > 0
                ? `${components.head.toFixed(0)} km/h en contra`
                : `${(-components.head).toFixed(0)} km/h a favor`}
            {components.cross >= 1 && (
              <>
                {" · "}
                {components.cross.toFixed(0)} km/h cruzado de{" "}
                {components.crossSide === "izq" ? "izquierda" : "derecha"}
              </>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            sin GPS — solo dirección general
          </div>
        )}
      </div>
    </div>
  );
}
