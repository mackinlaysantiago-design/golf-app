/**
 * Lista de cards con la dispersión por palo.
 * Cada card muestra el óvalo dibujado a escala + métricas.
 */

import { Card } from "@/components/ui/Card";

type Row = {
  club: string;
  carryAvgYds: number;
  carryDevYds: number;
  lateralDevYds: number;
  lateralBiasYds: number;
  lateralBiasDir: string;
  ellipseLengthYds: number;
  ellipseWidthYds: number;
  sessionsCount: number;
  lastUpdated: string;
};

export default function DispersionList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <Card className="text-center text-sm text-[var(--muted)] !p-4">
        Todavía no subiste dispersión.
        <br />
        Hacé tu sesión de FlightScope en un chat de Claude, después pegá acá el CSV resumen.
      </Card>
    );
  }

  // Escala global: el óvalo más grande del set marca el max para que todos sean comparables visualmente
  const maxLen = Math.max(...rows.map((r) => r.ellipseLengthYds || r.carryDevYds * 2));
  const maxWidth = Math.max(...rows.map((r) => r.ellipseWidthYds || r.lateralDevYds * 2));
  const maxBias = Math.max(...rows.map((r) => Math.abs(r.lateralBiasYds)));

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.club} className="!p-3">
          <div className="flex items-center justify-between gap-3">
            {/* Columna izq: data */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-[var(--fairway)] text-base">{r.club}</span>
                <span className="text-[10px] text-[var(--muted)]">
                  {r.sessionsCount} {r.sessionsCount === 1 ? "sesión" : "sesiones"} · {r.lastUpdated}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                <Stat label="Carry avg" value={`${Math.round(r.carryAvgYds)} yds`} bold />
                <Stat
                  label="Bias"
                  value={
                    r.lateralBiasYds === 0
                      ? "centrado"
                      : `${r.lateralBiasYds.toFixed(1)} ${r.lateralBiasDir}`
                  }
                />
                <Stat label="Carry σ" value={`±${r.carryDevYds.toFixed(0)}`} />
                <Stat label="Lateral σ" value={`±${r.lateralDevYds.toFixed(0)}`} />
              </div>
              <div className="mt-1.5 text-[10px] text-[var(--muted)]">
                Óvalo: <span className="gf-mono">{r.ellipseLengthYds.toFixed(0)}×{r.ellipseWidthYds.toFixed(0)} yds</span>
              </div>
            </div>
            {/* Columna der: SVG del óvalo a escala */}
            <EllipseViz
              lengthYds={r.ellipseLengthYds || r.carryDevYds * 2}
              widthYds={r.ellipseWidthYds || r.lateralDevYds * 2}
              biasYds={r.lateralBiasYds}
              biasDir={r.lateralBiasDir}
              maxLen={maxLen}
              maxWidth={Math.max(maxWidth, maxBias * 2 + 10)}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[var(--muted)] uppercase tracking-wider text-[9px]">{label}</span>
      <span className={`gf-mono ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function EllipseViz({
  lengthYds,
  widthYds,
  biasYds,
  biasDir,
  maxLen,
  maxWidth,
}: {
  lengthYds: number;
  widthYds: number;
  biasYds: number;
  biasDir: string;
  maxLen: number;
  maxWidth: number;
}) {
  // SVG vista aérea: vertical = carry (length), horizontal = lateral (width)
  // Target en (0,0). El óvalo se centra en (bias, 0).
  const W = 110;
  const H = 90;
  const cx = W / 2;
  const cy = H / 2;
  // Escala (mismo factor para X y Y para mantener proporciones reales)
  const maxDim = Math.max(maxLen, maxWidth);
  const scale = Math.min(W, H) / (maxDim * 1.15); // pequeño margen
  const rx = (widthYds / 2) * scale;
  const ry = (lengthYds / 2) * scale;
  const biasPx = biasYds * scale * (biasDir === "L" ? -1 : 1);
  const ellipseCx = cx + biasPx;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      {/* Target line (vertical center) */}
      <line x1={cx} y1={4} x2={cx} y2={H - 4} stroke="#d0d0d0" strokeWidth="1" strokeDasharray="2 2" />
      <line x1={4} y1={cy} x2={W - 4} y2={cy} stroke="#d0d0d0" strokeWidth="1" strokeDasharray="2 2" />
      {/* Target dot */}
      <circle cx={cx} cy={cy} r="2" fill="#1a7a3c" />
      {/* Ellipse (donde caen las bolas) */}
      <ellipse
        cx={ellipseCx}
        cy={cy}
        rx={Math.max(rx, 2)}
        ry={Math.max(ry, 2)}
        fill="rgba(26, 122, 60, 0.18)"
        stroke="#1a7a3c"
        strokeWidth="1.2"
      />
      {/* Bias dot center */}
      <circle cx={ellipseCx} cy={cy} r="1.5" fill="#0f4a24" />
    </svg>
  );
}
