"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ShareData_NavigatorPayload = { files: File[] };

export type ShareData = {
  roundId: string;
  courseName: string;
  date: string; // ISO
  modality: string;
  mode: string;
  holesPlayed: number;
  nineWhich: string | null;
  scorecard: {
    holes: Array<{ number: number; par: number; hcpHoyo: number }>;
    players: Array<{
      id: string;
      name: string;
      hcpIndex: number | null;
      isMe: boolean;
      scoresByHole: Record<number, number>;
    }>;
  };
  betResults: Array<{
    modality: string;
    label: string;
    amount: number;
    winnerNames: string[];
    tie: boolean;
    totalPot: number;
    scoresDisplay: Array<{ name: string; display: string; isMe: boolean }>;
  }>;
  pairsProgression: {
    pairAName: string;
    pairBName: string;
    holes: Array<{
      holeNumber: number;
      par: number;
      ptsA: number;
      ptsB: number;
      cumA: number;
      cumB: number;
      stblA: number;
      stblB: number;
      cumStblA: number;
      cumStblB: number;
    }>;
    finalMatchA: number;
    finalMatchB: number;
    finalStblA: number;
    finalStblB: number;
  } | null;
};

const C = {
  fairway: "#0f4a24",
  green: "#1a7a3c",
  greenPale: "#e8f5ed",
  border: "#d0e6d5",
  ink: "#0d1a0f",
  muted: "#6b7c6e",
  accent: "#d4a017",
  accentLight: "#fdf3d0",
  red: "#c0392b",
  sand: "#f5efe0",
};

export default function ShareClient({ data }: { data: ShareData }) {
  const snapshotRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Pre-cache del PNG. iOS Safari requiere que navigator.share() se invoque
  // SÍNCRONO al user gesture; cualquier await previo rompe el gesture y
  // tira "request is not allowed by the user agent". Solución: generar el
  // blob al montar y al click solo invocar share().
  const [cachedFile, setCachedFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);

  function showStatus(msg: string, autoHideMs = 4000) {
    setStatus(msg);
    if (autoHideMs > 0) {
      setTimeout(() => setStatus((s) => (s === msg ? null : s)), autoHideMs);
    }
  }

  function makeFilename() {
    const safeCourse = data.courseName.replace(/\s+/g, "-");
    const safeDate = new Date(data.date).toISOString().slice(0, 10);
    return `ronda-${safeCourse}-${safeDate}.png`;
  }

  async function captureCanvas() {
    if (!snapshotRef.current) throw new Error("No hay nada para capturar");
    const html2canvas = (await import("html2canvas-pro")).default;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    return html2canvas(snapshotRef.current, {
      scale: isMobile ? 1.5 : 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  }

  async function generateFile(): Promise<File> {
    const canvas = await captureCanvas();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("No se pudo generar el PNG");
    return new File([blob], makeFilename(), { type: "image/png" });
  }

  // Pre-generar el PNG en background después del mount, así share() es síncrono al click
  useEffect(() => {
    if (cachedFile || preparing) return;
    let cancelled = false;
    setPreparing(true);
    // Pequeño delay para que el DOM esté pintado del todo
    const timer = setTimeout(() => {
      generateFile()
        .then((file) => {
          if (!cancelled) setCachedFile(file);
        })
        .catch((e) => {
          if (!cancelled) console.error("[share] pre-cache failed", e);
        })
        .finally(() => {
          if (!cancelled) setPreparing(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setStatus(null);
    try {
      const file = cachedFile ?? (await generateFile());
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      showStatus("✓ PNG descargado");
    } catch (e) {
      showStatus(`✗ Error: ${(e as Error).message}`, 6000);
    } finally {
      setDownloading(false);
    }
  }

  // SÍNCRONO al click (no async) para preservar el user gesture en iOS Safari.
  // El file viene pre-cacheado del useEffect. Si todavía no está listo,
  // mostramos un warning y caemos a download (que no requiere gesture sync).
  function handleNativeShare() {
    setStatus(null);
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      showStatus("⚠️ Tu navegador no soporta compartir nativo · descargando PNG…", 4000);
      handleDownload();
      return;
    }
    if (!cachedFile) {
      showStatus(preparing ? "Generando imagen, probá de nuevo en 2s…" : "⚠️ Imagen no lista · descargando…", 3000);
      handleDownload();
      return;
    }
    const payload: ShareData_NavigatorPayload = { files: [cachedFile] };
    const supportsFiles =
      typeof navigator.canShare === "function" ? navigator.canShare(payload) : true;
    if (!supportsFiles) {
      showStatus("⚠️ Este navegador no soporta compartir imágenes · descargando…", 4000);
      handleDownload();
      return;
    }
    // navigator.share() INMEDIATO sin awaits previos → preserva el user gesture
    navigator
      .share({
        ...payload,
        title: `Ronda en ${data.courseName}`,
        text: `Ronda del ${new Date(data.date).toLocaleDateString("es-AR")}`,
      })
      .then(() => showStatus("✓ Compartido", 2500))
      .catch((e: Error) => {
        if (e.name === "AbortError" || (e.message ?? "").toLowerCase().includes("cancel")) {
          setStatus(null);
          return;
        }
        console.error("[share]", e);
        showStatus(`✗ ${e.message}`, 6000);
      });
  }

  return (
    <div style={{ minHeight: "100vh", background: C.sand }}>
      {/* Toolbar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
          padding: "8px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, maxWidth: 820, margin: "0 auto", fontSize: 13 }}>
          <Link href={`/rondas/${data.roundId}/resumen`} style={{ color: C.fairway }}>
            ← Volver al resumen
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleNativeShare}
              disabled={downloading || preparing}
              style={{
                background: C.fairway,
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                cursor: (downloading || preparing) ? "not-allowed" : "pointer",
                opacity: (downloading || preparing) ? 0.5 : 1,
              }}
            >
              {preparing ? "Preparando…" : downloading ? "…" : "📤 Compartir"}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                background: "white",
                color: C.fairway,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${C.fairway}`,
                cursor: downloading ? "not-allowed" : "pointer",
                opacity: downloading ? 0.5 : 1,
              }}
            >
              {downloading ? "Generando…" : "💾 Descargar PNG"}
            </button>
          </div>
        </div>
        {status && (
          <div
            style={{
              maxWidth: 820,
              margin: "6px auto 0",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: status.startsWith("✗") ? "#FBE5E1" : status.startsWith("⚠️") ? "#FDF3D0" : "#E8F5ED",
              color: status.startsWith("✗") ? C.red : status.startsWith("⚠️") ? C.accent : C.green,
              textAlign: "center",
            }}
          >
            {status}
          </div>
        )}
      </div>

      {/* Snapshot capturable */}
      <div style={{ padding: "16px 8px", display: "flex", justifyContent: "center" }}>
        <div
          ref={snapshotRef}
          style={{
            width: 800,
            maxWidth: "100%",
            background: "white",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            color: C.ink,
          }}
        >
          <Header data={data} />
          <ScorecardTable scorecard={data.scorecard} />
          {data.pairsProgression && (
            <ProgressionSection prog={data.pairsProgression} />
          )}
          {data.betResults.length > 0 && <BetsSection bets={data.betResults} />}
          <Footer />
        </div>
      </div>
    </div>
  );
}

// ============ Sub-components ============

function Header({ data }: { data: ShareData }) {
  return (
    <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 12, marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Ronda · {data.modality}
        {data.holesPlayed === 9 && data.nineWhich ? ` · ${data.nineWhich === "IDA" ? "9 IDA" : "9 VUELTA"}` : ""}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.fairway, marginTop: 2 }}>
        {data.courseName}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
        {new Date(data.date).toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

function BetsSection({ bets }: { bets: ShareData["betResults"] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionTitle>🏆 Resultados por juego</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bets.map((br) => (
          <div
            key={br.modality}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "8px 12px",
              background: br.tie ? C.greenPale : "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.fairway }}>{br.label}</span>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--font-dm-mono), monospace" }}>
                ${br.amount.toLocaleString("es-AR")} c/u
              </span>
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {br.tie ? (
                <span style={{ color: C.accent, fontWeight: 600 }}>Empate · sin ganador</span>
              ) : br.winnerNames.length >= 1 ? (
                <span>
                  Ganó <strong style={{ color: C.green }}>{br.winnerNames.join(" + ")}</strong>
                  {" · cobra "}
                  <strong>${br.totalPot.toLocaleString("es-AR")}</strong>
                </span>
              ) : (
                <span style={{ color: C.muted }}>— sin definir</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "var(--font-dm-mono), monospace" }}>
              {br.scoresDisplay.map((s, i) => (
                <span key={s.name} style={{ color: s.isMe ? C.accent : C.muted }}>
                  {i > 0 && " · "}
                  {s.name.split(" ")[0]}: {s.display}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressionSection({ prog }: { prog: NonNullable<ShareData["pairsProgression"]> }) {
  // Tabla compacta de progresión: H | par | PtsA / PtsB | StblA / StblB | Acum
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionTitle>📊 Progresión por hoyo · Match BB+WB</SectionTitle>
      <div style={{ display: "flex", gap: 8, fontSize: 11, marginBottom: 8 }}>
        <BadgeTeam label="Pareja A" name={prog.pairAName} match={prog.finalMatchA} stbl={prog.finalStblA} winning={prog.finalMatchA > prog.finalMatchB} />
        <BadgeTeam label="Pareja B" name={prog.pairBName} match={prog.finalMatchB} stbl={prog.finalStblB} winning={prog.finalMatchB > prog.finalMatchA} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-dm-mono), monospace" }}>
        <thead>
          <tr style={{ background: C.greenPale, color: C.fairway, fontWeight: 700 }}>
            <th style={{ padding: "4px 6px", textAlign: "left" }}>H</th>
            <th style={{ padding: "4px 6px", textAlign: "center" }}>Par</th>
            <th style={{ padding: "4px 6px", textAlign: "center" }} colSpan={2}>Match (BB+WB)</th>
            <th style={{ padding: "4px 6px", textAlign: "center" }} colSpan={2}>Stbl</th>
            <th style={{ padding: "4px 6px", textAlign: "center" }} colSpan={2}>Acum Match</th>
          </tr>
          <tr style={{ background: C.greenPale, color: C.muted, fontSize: 9 }}>
            <th></th>
            <th></th>
            <th style={{ padding: "2px 4px" }}>A</th>
            <th style={{ padding: "2px 4px" }}>B</th>
            <th style={{ padding: "2px 4px" }}>A</th>
            <th style={{ padding: "2px 4px" }}>B</th>
            <th style={{ padding: "2px 4px" }}>A</th>
            <th style={{ padding: "2px 4px" }}>B</th>
          </tr>
        </thead>
        <tbody>
          {prog.holes.map((h, i) => {
            const isOut = i === 8;
            return (
              <tr
                key={h.holeNumber}
                style={{
                  borderTop: isOut ? `2px solid ${C.fairway}` : `1px solid ${C.border}`,
                }}
              >
                <td style={{ padding: "4px 6px", fontWeight: 700 }}>{h.holeNumber}</td>
                <td style={{ padding: "4px 6px", textAlign: "center", color: C.muted }}>{h.par}</td>
                <td style={{ padding: "4px 6px", textAlign: "center", color: h.ptsA > h.ptsB ? C.green : C.ink }}>
                  {h.ptsA || ""}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center", color: h.ptsB > h.ptsA ? C.green : C.ink }}>
                  {h.ptsB || ""}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>{h.stblA}</td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>{h.stblB}</td>
                <td style={{ padding: "4px 6px", textAlign: "center", fontWeight: 700, color: h.cumA > h.cumB ? C.green : C.ink }}>
                  {h.cumA}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center", fontWeight: 700, color: h.cumB > h.cumA ? C.green : C.ink }}>
                  {h.cumB}
                </td>
              </tr>
            );
          })}
          <tr style={{ background: C.greenPale, fontWeight: 700, borderTop: `2px solid ${C.fairway}` }}>
            <td colSpan={6} style={{ padding: "6px", textAlign: "right", color: C.fairway }}>TOTAL</td>
            <td style={{ padding: "6px", textAlign: "center", color: prog.finalMatchA >= prog.finalMatchB ? C.green : C.ink }}>
              {prog.finalMatchA}
            </td>
            <td style={{ padding: "6px", textAlign: "center", color: prog.finalMatchB >= prog.finalMatchA ? C.green : C.ink }}>
              {prog.finalMatchB}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BadgeTeam({ label, name, match, stbl, winning }: { label: string; name: string; match: number; stbl: number; winning: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "8px 10px",
        border: `2px solid ${winning ? C.green : C.border}`,
        borderRadius: 10,
        background: winning ? C.greenPale : "white",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
        {winning && <span style={{ color: C.green, marginLeft: 4 }}>· LIDER</span>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginTop: 1, lineHeight: 1.15 }}>{name}</div>
      <div style={{ fontSize: 11, color: C.fairway, marginTop: 3, fontFamily: "var(--font-dm-mono), monospace" }}>
        Match: <strong>{match}</strong> · Stbl: <strong>{stbl}</strong>
      </div>
    </div>
  );
}

function ScorecardTable({ scorecard }: { scorecard: ShareData["scorecard"] }) {
  const { holes, players } = scorecard;
  const idaHoles = holes.filter((h) => h.number <= 9);
  const vueltaHoles = holes.filter((h) => h.number >= 10);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const idaPar = idaHoles.reduce((s, h) => s + h.par, 0);
  const vueltaPar = vueltaHoles.reduce((s, h) => s + h.par, 0);

  function totalForPlayer(p: typeof players[number], hs: typeof holes) {
    let total = 0;
    let parPlayed = 0;
    for (const h of hs) {
      const sc = p.scoresByHole[h.number];
      if (sc) {
        total += sc;
        parPlayed += h.par;
      }
    }
    return { total, parPlayed };
  }

  function vsParCell(total: number, parPlayed: number) {
    if (total === 0) return { text: "—", color: C.muted };
    const vs = total - parPlayed;
    if (vs === 0) return { text: "E", color: C.muted };
    if (vs > 0) return { text: `+${vs}`, color: vs <= 6 ? C.accent : C.red };
    return { text: `${vs}`, color: C.green };
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <SectionTitle>📋 Scorecard · golpes por hoyo</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-dm-mono), monospace" }}>
        <thead>
          <tr style={{ background: C.greenPale, color: C.fairway }}>
            <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 700, width: 32 }}>H</th>
            <th style={{ padding: "4px 6px", textAlign: "center", fontWeight: 700, width: 32 }}>Par</th>
            {players.map((p) => (
              <th
                key={p.id}
                style={{
                  padding: "4px 6px",
                  textAlign: "center",
                  fontWeight: 700,
                  color: p.isMe ? C.accent : C.fairway,
                  fontSize: 10,
                }}
              >
                {p.name.split(" ")[0]}
                {p.hcpIndex != null && (
                  <div style={{ fontSize: 9, fontWeight: 500, color: C.muted }}>
                    HCP {p.hcpIndex.toFixed(1)}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holes.map((h, i) => {
            const isOutTransition = i > 0 && h.number === 10;
            return (
              <tr
                key={h.number}
                style={{
                  borderTop: isOutTransition ? `2px solid ${C.fairway}` : `1px solid ${C.border}`,
                }}
              >
                <td style={{ padding: "3px 6px", fontWeight: 700, color: C.fairway }}>{h.number}</td>
                <td style={{ padding: "3px 6px", textAlign: "center", color: C.muted }}>{h.par}</td>
                {players.map((p) => {
                  const sc = p.scoresByHole[h.number];
                  let color = C.ink;
                  let bg = "transparent";
                  if (sc) {
                    const vs = sc - h.par;
                    if (vs <= -2) {
                      color = "white";
                      bg = C.green; // eagle o mejor
                    } else if (vs === -1) {
                      color = C.green;
                      bg = C.greenPale; // birdie
                    } else if (vs === 0) {
                      color = C.ink;
                    } else if (vs === 1) {
                      color = C.accent;
                    } else {
                      color = C.red;
                    }
                  }
                  return (
                    <td
                      key={p.id}
                      style={{
                        padding: "3px 6px",
                        textAlign: "center",
                        color,
                        background: bg,
                        fontWeight: sc ? 600 : 400,
                      }}
                    >
                      {sc || "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* Total IDA si tiene IDA */}
          {idaHoles.length > 0 && vueltaHoles.length > 0 && (
            <tr style={{ background: C.greenPale, fontWeight: 700, borderTop: `2px solid ${C.fairway}` }}>
              <td style={{ padding: "5px 6px", color: C.fairway }}>IDA</td>
              <td style={{ padding: "5px 6px", textAlign: "center", color: C.muted }}>{idaPar}</td>
              {players.map((p) => {
                const { total, parPlayed } = totalForPlayer(p, idaHoles);
                const vp = vsParCell(total, parPlayed);
                return (
                  <td key={p.id} style={{ padding: "5px 6px", textAlign: "center" }}>
                    <div>{total || "—"}</div>
                    {total > 0 && <div style={{ fontSize: 9, color: vp.color }}>{vp.text}</div>}
                  </td>
                );
              })}
            </tr>
          )}
          {/* Total VUELTA */}
          {vueltaHoles.length > 0 && idaHoles.length > 0 && (
            <tr style={{ background: C.greenPale, fontWeight: 700 }}>
              <td style={{ padding: "5px 6px", color: C.fairway }}>VUELTA</td>
              <td style={{ padding: "5px 6px", textAlign: "center", color: C.muted }}>{vueltaPar}</td>
              {players.map((p) => {
                const { total, parPlayed } = totalForPlayer(p, vueltaHoles);
                const vp = vsParCell(total, parPlayed);
                return (
                  <td key={p.id} style={{ padding: "5px 6px", textAlign: "center" }}>
                    <div>{total || "—"}</div>
                    {total > 0 && <div style={{ fontSize: 9, color: vp.color }}>{vp.text}</div>}
                  </td>
                );
              })}
            </tr>
          )}
          {/* Total general */}
          <tr style={{ background: C.fairway, color: "white", fontWeight: 700, borderTop: `2px solid ${C.fairway}` }}>
            <td style={{ padding: "6px" }}>TOTAL</td>
            <td style={{ padding: "6px", textAlign: "center" }}>{totalPar}</td>
            {players.map((p) => {
              const { total, parPlayed } = totalForPlayer(p, holes);
              const vp = vsParCell(total, parPlayed);
              return (
                <td key={p.id} style={{ padding: "6px", textAlign: "center" }}>
                  <div style={{ fontSize: 13 }}>{total || "—"}</div>
                  {total > 0 && (
                    <div style={{ fontSize: 10, opacity: 0.85 }}>{vp.text}</div>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.fairway,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {children}
    </div>
  );
}

function Footer() {
  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${C.border}`, textAlign: "center", fontSize: 9, color: C.muted, letterSpacing: "0.04em" }}>
      Tracked with Scoring Method Tracker
    </div>
  );
}
