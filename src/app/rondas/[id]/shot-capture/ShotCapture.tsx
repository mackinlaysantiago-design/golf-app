"use client";

// T2.1 — Captura de un tiro on-course: GPS vivo + grabación de voz + POST a /api/shots/voice.
// Reutiliza computeShotGeo/suggestClub (F1) y el route de Gemini (F2.3, ya probado).
// Verificación de browser (mic + GPS reales) queda para probar con el dev server en un teléfono.

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  computeShotGeo,
  suggestClub,
  type LatLng,
  type HoleGreen,
  type ClubCarry,
} from "@/lib/shot-gps";
import type { ParsedShot } from "@/lib/gemini-shot";

type Props = {
  roundHoleId: string;
  holeNumber: number;
  par: number;
  green: HoleGreen;
  carries: ClubCarry[];
  shotNumber: number;
  prevPos?: LatLng | null;
  onSaved?: (parsed: ParsedShot) => void;
};

type Phase = "idle" | "recording" | "sending" | "done" | "error";

export default function ShotCapture({
  roundHoleId,
  holeNumber,
  par,
  green,
  carries,
  shotNumber,
  prevPos,
  onSaved,
}: Props) {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedShot | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // GPS vivo (mismo patrón que GpsView)
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta GPS");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGpsError(null);
      },
      (e) => setGpsError(e.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const geo = pos ? computeShotGeo(pos, green, prevPos ?? null) : null;
  const sugg =
    geo?.distToCenterYds != null ? suggestClub(geo.distToCenterYds, carries) : null;

  async function startRecording() {
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void sendAudio(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      recorderRef.current = rec;
      rec.start();
      setPhase("recording");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "no pude acceder al micrófono");
      setPhase("error");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setPhase("sending");
  }

  async function sendAudio(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "shot.webm");
      fd.append("roundHoleId", roundHoleId);
      fd.append("shotNumber", String(shotNumber));
      fd.append("holeNumber", String(holeNumber));
      fd.append("par", String(par));
      if (geo?.distToCenterYds != null) fd.append("distanceToTargetYds", String(geo.distToCenterYds));
      if (geo?.shotLengthYds != null) fd.append("shotLengthYds", String(geo.shotLengthYds));
      if (pos) {
        fd.append("fromLat", String(pos.lat));
        fd.append("fromLng", String(pos.lng));
      }
      const res = await fetch("/api/shots/voice", { method: "POST", body: fd });
      const json = (await res.json()) as { parsed?: ParsedShot; error?: string };
      if (!res.ok || !json.parsed) throw new Error(json.error || "error en el servidor");
      setParsed(json.parsed);
      setPhase("done");
      onSaved?.(json.parsed);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "error enviando el audio");
      setPhase("error");
    }
  }

  const fmt = (n: number | null | undefined) => (n != null ? `${n}` : "—");

  return (
    <div style={{ maxWidth: 430, margin: "0 auto" }}>
      <Card>
        <div style={{ fontWeight: 700 }}>
          Hoyo {holeNumber} · Par {par} · Tiro {shotNumber}
        </div>
        {gpsError ? (
          <div style={{ color: "var(--bad, #dc2626)", fontSize: 13 }}>GPS: {gpsError}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Metric label="frente" value={fmt(geo?.distToFrontYds)} />
            <Metric label="centro" value={fmt(geo?.distToCenterYds)} big />
            <Metric label="fondo" value={fmt(geo?.distToBackYds)} />
          </div>
        )}
        {sugg && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            💡 {geo?.distToCenterYds} yd → <b>{sugg.pick.club}</b>
            {sugg.alt ? ` (alt ${sugg.alt.club})` : ""}
          </div>
        )}
      </Card>

      <Card>
        {phase === "recording" ? (
          <button onClick={stopRecording} style={btn("#dc2626")}>
            ⏹ Detener y guardar
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={phase === "sending"}
            style={btn("#15803d")}
          >
            {phase === "sending" ? "Procesando…" : "🎙 Dictar el tiro"}
          </button>
        )}
        {errMsg && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{errMsg}</div>}
      </Card>

      {phase === "done" && parsed && (
        <Card>
          <div style={{ fontSize: 12, color: "#6b7d72", fontStyle: "italic" }}>
            🎙 {parsed.transcript}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
            <Chip k="Palo" v={parsed.club ?? "—"} />
            <Chip k="Decisión" v={parsed.decisionQuality ?? "—"} />
            <Chip k="Ejecución" v={parsed.executionQuality ?? "—"} />
            <Chip k="Resultado" v={parsed.result ?? "—"} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: 8, borderRadius: 12, background: big ? "#e8f5ec" : "#f1f4f1" }}>
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7d72" }}>{label}</div>
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 10, background: "#eef2ee" }}>
      <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", marginRight: 5 }}>{k}</span>
      {v}
    </span>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    width: "100%",
    padding: "16px",
    borderRadius: 14,
    border: "none",
    color: "#fff",
    background: bg,
    fontSize: 16,
    fontWeight: 700,
  };
}
