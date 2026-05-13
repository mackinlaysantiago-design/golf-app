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

    </div>
  );
}
