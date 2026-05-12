"use client";

/**
 * Cliente del Advanced Scorecard.
 * - Editor lateral para best parts (3) + best shot description.
 * - Tabs: Front (página 1) / Back (página 2).
 * - Descarga PNG: 2 archivos separados (front.png + back.png) o ambos combinados.
 * - Guardar persiste best parts + best shot al Round.
 */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { OfficialScorecard } from "@/components/scorecard/OfficialScorecard";
import { OfficialScorecardBack } from "@/components/scorecard/OfficialScorecardBack";
import type { ScorecardData } from "@/lib/scorecard";

export default function ScorecardClient({
  roundId,
  initialData,
}: {
  roundId: string;
  initialData: ScorecardData;
}) {
  const [data, setData] = useState<ScorecardData>(initialData);
  const [activeTab, setActiveTab] = useState<"front" | "back">("front");
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [downloading, setDownloading] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  function setBestPart(i: 0 | 1 | 2, value: string) {
    setData((d) => {
      const next = [...d.bestParts] as [string, string, string];
      next[i] = value;
      return { ...d, bestParts: next };
    });
  }

  async function handleSave() {
    setSaveStatus("idle");
    startTransition(async () => {
      try {
        const resp = await fetch(`/api/rondas/${roundId}/scorecard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bestParts: data.bestParts,
            bestShot: data.bestShotDescription,
          }),
        });
        if (!resp.ok) throw new Error("save failed");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch {
        setSaveStatus("error");
      }
    });
  }

  async function handleDownload(which: "front" | "back" | "both") {
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const safeName = data.playerName.replace(/\s+/g, "-");
      const safeDate = data.date.replace(/\//g, "-");

      const capture = async (ref: HTMLDivElement, suffix: string) => {
        const canvas = await html2canvas(ref, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });
        const link = document.createElement("a");
        link.download = `scorecard-${suffix}-${safeName}-${safeDate}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      };

      if ((which === "front" || which === "both") && frontRef.current) {
        await capture(frontRef.current, "front");
      }
      if ((which === "back" || which === "both") && backRef.current) {
        await capture(backRef.current, "back");
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e8e8e8]">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b bg-white/90 px-4 py-2 backdrop-blur" style={{ borderColor: "#7CAA8E" }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 text-sm">
          <Link href={`/rondas/${roundId}/resumen`} className="text-[#1E5631] hover:underline">
            ← Volver al resumen
          </Link>
          {/* Tabs */}
          <div className="flex gap-1 rounded bg-gray-200 p-0.5">
            <button
              onClick={() => setActiveTab("front")}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                activeTab === "front" ? "bg-[#1E5631] text-white" : "text-gray-700"
              }`}
            >
              Front (scorecard)
            </button>
            <button
              onClick={() => setActiveTab("back")}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                activeTab === "back" ? "bg-[#1E5631] text-white" : "text-gray-700"
              }`}
            >
              Back (10 keys + best shot)
            </button>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === "saved" && <span className="text-xs text-green-700">✓ Guardado</span>}
            {saveStatus === "error" && <span className="text-xs text-red-700">✗ Error</span>}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded bg-[#1E5631] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16432a] disabled:opacity-50"
            >
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <div className="flex">
              <button
                onClick={() => handleDownload(activeTab)}
                disabled={downloading}
                className="rounded-l border border-[#1E5631] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E5631] hover:bg-[#1E5631] hover:text-white disabled:opacity-50"
              >
                {downloading ? "…" : `Descargar ${activeTab === "front" ? "Front" : "Back"}`}
              </button>
              <button
                onClick={() => handleDownload("both")}
                disabled={downloading}
                className="rounded-r border border-l-0 border-[#1E5631] bg-white px-2 py-1.5 text-xs font-semibold text-[#1E5631] hover:bg-[#1E5631] hover:text-white disabled:opacity-50"
                title="Descargar ambas"
              >
                Both
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Layout: card + editor */}
      <div className="mx-auto flex max-w-[1750px] gap-4 px-4 py-6">
        <div className="flex-shrink-0">
          {/* Renderear ambas siempre, ocultar la inactiva para que el ref siga válido para descarga */}
          <div ref={frontRef} style={{ display: activeTab === "front" ? "block" : "none" }}>
            <OfficialScorecard data={data} />
          </div>
          <div ref={backRef} style={{ display: activeTab === "back" ? "block" : "none" }}>
            <OfficialScorecardBack data={data} />
          </div>
        </div>

        {/* Editor lateral */}
        <aside className="w-[300px] flex-shrink-0 space-y-4 rounded-lg bg-white p-4 shadow">
          <h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wider text-[#1E5631]">
            Editar campos libres
          </h2>
          <p className="text-[11px] text-gray-600">
            Los datos por hoyo se completan automáticamente desde tu carga del RondaTracker.
            Acá solo agregás reflexiones libres.
          </p>

          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#1E5631]">
              Best Parts of Your Round
            </h3>
            <div className="space-y-2">
              {([0, 1, 2] as const).map((i) => (
                <input
                  key={i}
                  type="text"
                  value={data.bestParts[i]}
                  onChange={(e) => setBestPart(i, e.target.value)}
                  placeholder={`Best part ${i + 1}…`}
                  className="w-full rounded border px-2 py-1 text-xs focus:border-[#1E5631] focus:outline-none"
                  style={{ borderColor: "#d0e6d5" }}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#1E5631]">
              Describe Your Best Shot
            </h3>
            <textarea
              value={data.bestShotDescription}
              onChange={(e) =>
                setData((d) => ({ ...d, bestShotDescription: e.target.value }))
              }
              rows={5}
              className="w-full rounded border px-2 py-1 text-xs focus:border-[#1E5631] focus:outline-none"
              style={{ borderColor: "#d0e6d5" }}
            />
          </div>

          <div className="rounded bg-blue-50 p-2 text-[11px] text-blue-900">
            <strong>Tip:</strong> el panel de edición no se incluye al descargar el PNG.
            La imagen solo tiene el scorecard limpio listo para subir a Circle.
          </div>
        </aside>
      </div>
    </div>
  );
}
