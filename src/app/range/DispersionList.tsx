/**
 * Lista de cards con la dispersión por palo (formato percentiles).
 * Replica la viz vieja de /range/stats:
 *   - Barra horizontal safe → typical → good (P25 - P50 - P90)
 *   - Aim card destacada con la dirección típica
 *   - Stats: confidence, total típico, bias, spread
 */

import { Card } from "@/components/ui/Card";
import { aimText } from "@/lib/club-dispersion";

type Row = {
  club: string;
  n: number;
  carryP25: number;
  carryP50: number;
  carryP90: number;
  confidencePct: number;
  latP50: number;
  pctRight: number;
  latSpreadP90: number;
  sessionsCount: number;
  lastUpdated: string;
};

export default function DispersionList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <Card className="text-center text-sm text-[var(--muted)] !p-4">
        Todavía no subiste dispersión.
        <br />
        Hacé tu sesión de FlightScope en un chat de Claude, después pegá acá el CSV de percentiles.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Tabla compacta para decisión rápida */}
      <Card className="!p-2 overflow-x-auto">
        <table className="w-full text-[11px] gf-mono">
          <thead>
            <tr className="text-[var(--muted)] uppercase tracking-wider text-[9px]">
              <th className="text-left py-1 pr-2">Palo</th>
              <th className="text-right" title="P25 · llegás casi siempre">Seguro</th>
              <th className="text-right" title="Mediana · lo más común">Típico</th>
              <th className="text-right" title="P90 · cuando le pegás bien">Bueno</th>
              <th className="text-right" title="% shots ±10y de mediana">Conf</th>
              <th className="text-right" title="Para dónde sale en promedio">Suele ir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const aim = aimText(s.latP50, s.pctRight);
              return (
                <tr key={s.club} className="border-t border-[var(--green-pale)]">
                  <td className="py-1.5 pr-2 font-semibold">
                    {s.club}
                    <span className="text-[9px] text-[var(--muted)] font-normal ml-1">({s.n})</span>
                  </td>
                  <td className="text-right text-[var(--muted)]">{s.carryP25.toFixed(0)}</td>
                  <td className="text-right font-bold text-[var(--fairway)]">{s.carryP50.toFixed(0)}</td>
                  <td className="text-right text-[var(--muted)]">{s.carryP90.toFixed(0)}</td>
                  <td
                    className="text-right"
                    style={{
                      color:
                        s.confidencePct >= 60
                          ? "var(--green)"
                          : s.confidencePct >= 40
                          ? "var(--accent)"
                          : "var(--red)",
                    }}
                  >
                    {s.confidencePct.toFixed(0)}%
                  </td>
                  <td
                    className="text-right"
                    style={{ color: aim.dir === "C" ? "var(--green)" : "var(--accent)" }}
                  >
                    {aim.dir === "C" ? "—" : `${aim.dir} ${aim.magnitude.toFixed(0)}y`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-[var(--muted)] mt-2 px-1 leading-snug">
          <strong>Seguro</strong>: casi siempre llegás · <strong>Típico</strong>: tu distancia normal ·{" "}
          <strong>Bueno</strong>: cuando le pegás bien · <strong>Conf</strong>: repetibilidad ·{" "}
          <strong>Suele ir</strong>: si dice <strong>R 10y</strong>, apuntá 10y a la izquierda
        </p>
      </Card>

      {/* Detalle expandido por palo */}
      {rows.map((s) => {
        const aim = aimText(s.latP50, s.pctRight);
        return (
          <Card key={`detail-${s.club}`} className="space-y-2">
            <div className="flex justify-between items-baseline border-b border-[var(--green-pale)] pb-2">
              <h2 className="font-bold text-lg text-[var(--fairway)]">{s.club}</h2>
              <span className="text-[10px] text-[var(--muted)] gf-mono">
                {s.n} shots · {s.sessionsCount} ses · {s.lastUpdated}
              </span>
            </div>

            {/* Barra safe → typical → good */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--muted)] gf-mono">
                <span>Seguro {s.carryP25.toFixed(0)}y</span>
                <span className="text-[var(--fairway)] font-bold">Típico {s.carryP50.toFixed(0)}y</span>
                <span>Bueno {s.carryP90.toFixed(0)}y</span>
              </div>
              <div className="relative h-3 bg-[var(--green-pale)] rounded-full overflow-hidden">
                {(() => {
                  const range = Math.max(s.carryP90 - s.carryP25, 1);
                  const typicalPct = ((s.carryP50 - s.carryP25) / range) * 100;
                  return (
                    <>
                      <div
                        className="absolute inset-y-0"
                        style={{
                          left: 0,
                          width: "100%",
                          background:
                            "linear-gradient(to right, var(--accent) 0%, var(--green) 50%, var(--accent) 100%)",
                          opacity: 0.4,
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-[var(--fairway)]"
                        style={{ left: `${typicalPct}%`, transform: "translateX(-50%)" }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Aim card destacada */}
            <div
              className="rounded-lg p-2 text-center"
              style={{
                background: aim.dir === "C" ? "var(--green-pale)" : "var(--accent)",
                color: aim.dir === "C" ? "var(--fairway)" : "white",
              }}
            >
              <div className="text-[9px] uppercase tracking-wider opacity-80">Suele caer</div>
              <div className="text-lg font-bold gf-display">{aim.label}</div>
              <div className="text-[10px] opacity-90 mt-0.5">{aim.aim}</div>
              {aim.dir !== "C" && (
                <div className="text-[9px] opacity-70 mt-0.5 gf-mono">
                  {s.pctRight.toFixed(0)}% R · {(100 - s.pctRight).toFixed(0)}% L · spread ±
                  {s.latSpreadP90.toFixed(0)}y
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] gf-mono pt-1">
              <div>
                <div className="text-[9px] text-[var(--muted)] uppercase">Confianza</div>
                <div
                  className="font-bold text-base"
                  style={{
                    color:
                      s.confidencePct >= 60
                        ? "var(--green)"
                        : s.confidencePct >= 40
                        ? "var(--accent)"
                        : "var(--red)",
                  }}
                >
                  {s.confidencePct.toFixed(0)}%
                </div>
                <div className="text-[9px] text-[var(--muted)]">±10y de mediana</div>
              </div>
              <div>
                <div className="text-[9px] text-[var(--muted)] uppercase">Bias</div>
                <div className="font-bold text-base">
                  {aim.dir === "C" ? "—" : `${aim.dir} ${aim.magnitude.toFixed(0)}y`}
                </div>
                <div className="text-[9px] text-[var(--muted)]">mediana lateral</div>
              </div>
              <div>
                <div className="text-[9px] text-[var(--muted)] uppercase">Spread</div>
                <div className="font-bold text-base">±{s.latSpreadP90.toFixed(0)}y</div>
                <div className="text-[9px] text-[var(--muted)]">P90 desde bias</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
