"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RoundPlayer = {
  id: string;
  hcpIndex: number | null;
  courseHcp: number | null;
  modalityHcps?: unknown;
  player: { id: string; name: string; isMe: boolean };
};

type Bet = {
  modality: string;
  amount: number;
  currency: string;
};

type Round = {
  id: string;
  courseId: string;
  tee: string;
  players: RoundPlayer[];
  bets: Bet[];
};

type HcpsState = {
  // por roundPlayerId
  [rpId: string]: {
    name: string;
    isMe: boolean;
    hcpIndex: string;
    medalTotal: string;
    medalIda: string;
    medalVuelta: string;
    stableford: string;
  };
};

type FamilyKey = "MATCH" | "MEDAL" | "STABLEFORD";
type BetsState = Record<FamilyKey, { enabled: boolean; total: string; leg: string }>;

function loadInitialHcps(round: Round): HcpsState {
  const out: HcpsState = {};
  for (const rp of round.players) {
    const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
    out[rp.id] = {
      name: rp.player.name,
      isMe: rp.player.isMe,
      hcpIndex: rp.hcpIndex != null ? String(rp.hcpIndex) : "",
      medalTotal: mh?.MEDAL != null ? String(mh.MEDAL) : rp.courseHcp != null ? String(rp.courseHcp) : "",
      medalIda: mh?.MEDAL_IDA != null ? String(mh.MEDAL_IDA) : "",
      medalVuelta: mh?.MEDAL_VUELTA != null ? String(mh.MEDAL_VUELTA) : "",
      stableford: mh?.STABLEFORD != null ? String(mh.STABLEFORD) : "",
    };
  }
  return out;
}

function loadInitialBets(bets: Bet[]): BetsState {
  const get = (mod: string) => bets.find((b) => b.modality === mod)?.amount;
  const family = (totalKey: string, idaKey: string): { enabled: boolean; total: string; leg: string } => {
    const total = get(totalKey);
    const ida = get(idaKey);
    const enabled = total != null || ida != null;
    return {
      enabled,
      total: total != null ? String(total) : "",
      leg: ida != null ? String(ida) : "",
    };
  };
  return {
    MATCH: family("MATCH", "MATCH_IDA"),
    MEDAL: family("MEDAL", "MEDAL_IDA"),
    STABLEFORD: family("STABLEFORD", "STABLEFORD_IDA"),
  };
}

export default function EditarSetupModal({
  round,
  onClose,
}: {
  round: Round;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"HCP" | "BETS">("HCP");
  const [hcps, setHcps] = useState<HcpsState>(() => loadInitialHcps(round));
  const [bets, setBets] = useState<BetsState>(() => loadInitialBets(round.bets));
  const [busy, setBusy] = useState(false);
  // Debounce timers + último valor disparado por jugador (para evitar race condition)
  const debounceRefs = useRef<Record<string, NodeJS.Timeout | null>>({});
  const lastIndexRefs = useRef<Record<string, string>>({});

  function setHcp(rpId: string, field: keyof HcpsState[string], value: string) {
    setHcps((prev) => ({
      ...prev,
      [rpId]: { ...prev[rpId], [field]: value },
    }));
  }

  // Cuando cambia el Index, lookup las 4 modalidades. Debounce 400ms + check de
  // que el index sigue siendo el mismo cuando llega la respuesta (anti race condition)
  function recomputeHcpsFromIndex(rpId: string, indexStr: string) {
    // Cancelar timer anterior
    const prev = debounceRefs.current[rpId];
    if (prev) clearTimeout(prev);

    // Marcar el último valor "intentado" para que respuestas viejas no pisen
    lastIndexRefs.current[rpId] = indexStr;

    debounceRefs.current[rpId] = setTimeout(async () => {
      // Si entre tanto el usuario siguió tipeando, este lookup ya quedó stale
      if (lastIndexRefs.current[rpId] !== indexStr) return;

      const idx = parseFloat(indexStr.replace(",", "."));
      if (isNaN(idx)) return;
      const modalities = ["MEDAL", "MEDAL_IDA", "MEDAL_VUELTA", "STABLEFORD"];
      const mapField: Record<string, keyof HcpsState[string]> = {
        MEDAL: "medalTotal",
        MEDAL_IDA: "medalIda",
        MEDAL_VUELTA: "medalVuelta",
        STABLEFORD: "stableford",
      };
      try {
        const updates = await Promise.all(
          modalities.map((mod) =>
            fetch(
              `/api/canchas/${round.courseId}/hcp?index=${idx}&modality=${mod}&tee=${encodeURIComponent(round.tee)}&category=CAB`,
            )
              .then((r) => r.json())
              .then((data) => ({ mod, ch: data.found ? data.courseHcp : null })),
          ),
        );
        // Re-check después del await: si el usuario cambió el index entre fetch
        // start y end, descartar este resultado
        if (lastIndexRefs.current[rpId] !== indexStr) return;
        setHcps((cur) => {
          // Sólo aplicar si el state actual del index sigue coincidiendo con lo que pedimos
          if (cur[rpId]?.hcpIndex !== indexStr) return cur;
          const next = { ...cur };
          for (const u of updates) {
            const fld = mapField[u.mod];
            next[rpId] = {
              ...next[rpId],
              [fld]: u.ch != null ? String(u.ch) : "",
            };
          }
          return next;
        });
      } catch {}
    }, 400);
  }

  function setBetField(fam: FamilyKey, field: "enabled" | "total" | "leg", value: string | boolean) {
    setBets((prev) => ({
      ...prev,
      [fam]: { ...prev[fam], [field]: value },
    }));
  }

  async function save() {
    setBusy(true);

    const playersPayload = Object.entries(hcps).map(([id, h]) => {
      const num = (s: string) => (s.trim() === "" ? null : parseFloat(s));
      const intNum = (s: string) => (s.trim() === "" ? null : parseInt(s));
      return {
        id,
        hcpIndex: num(h.hcpIndex),
        courseHcp: intNum(h.medalTotal),
        modalityHcps: {
          MEDAL: intNum(h.medalTotal),
          MEDAL_IDA: intNum(h.medalIda),
          MEDAL_VUELTA: intNum(h.medalVuelta),
          STABLEFORD: intNum(h.stableford),
        },
      };
    });

    const betsPayload: Bet[] = [];
    for (const [fam, f] of Object.entries(bets) as [FamilyKey, BetsState[FamilyKey]][]) {
      if (!f.enabled) continue;
      const total = f.total ? parseFloat(f.total) : 0;
      const leg = f.leg ? parseFloat(f.leg) : 0;
      if (total > 0) betsPayload.push({ modality: fam, amount: total, currency: "ARS" });
      if (leg > 0) {
        betsPayload.push({ modality: `${fam}_IDA`, amount: leg, currency: "ARS" });
        betsPayload.push({ modality: `${fam}_VUELTA`, amount: leg, currency: "ARS" });
      }
    }

    const res = await fetch(`/api/rondas/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: playersPayload, bets: betsPayload }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      alert("Error guardando");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/60 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--sand)] w-full md:max-w-md md:rounded-2xl overflow-y-auto max-h-screen p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="gf-display text-2xl text-[var(--fairway)]">Editar setup</h2>
          <button onClick={onClose} className="text-2xl px-2">✕</button>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("HCP")}
            className="flex-1 py-2 rounded text-sm font-semibold"
            style={{
              background: tab === "HCP" ? "var(--fairway)" : "var(--green-pale)",
              color: tab === "HCP" ? "white" : "var(--fairway)",
            }}
          >
            HCPs
          </button>
          <button
            type="button"
            onClick={() => setTab("BETS")}
            className="flex-1 py-2 rounded text-sm font-semibold"
            style={{
              background: tab === "BETS" ? "var(--fairway)" : "var(--green-pale)",
              color: tab === "BETS" ? "white" : "var(--fairway)",
            }}
          >
            Apuestas
          </button>
        </div>

        {tab === "HCP" && (
          <div className="space-y-3">
            <p className="text-[10px] text-[var(--muted)]">
              <strong>Match Total/Ida/Vuelta usan el HCP Stableford</strong>. Medal usa su CH propio
              por sección. Editá lo que necesites.
            </p>
            {Object.entries(hcps).map(([rpId, h]) => (
              <div key={rpId} className="gf-card !p-3 space-y-2">
                <div className="font-semibold text-sm">
                  {h.name}
                  {h.isMe && <span className="ml-2 gf-pill gf-pill-accent text-[10px]">YO</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Index"
                    value={h.hcpIndex}
                    onChange={(v) => {
                      setHcp(rpId, "hcpIndex", v);
                      recomputeHcpsFromIndex(rpId, v);
                    }}
                    decimal
                  />
                  <Field label="Medal Total" value={h.medalTotal} onChange={(v) => setHcp(rpId, "medalTotal", v)} />
                  <Field label="Medal Ida" value={h.medalIda} onChange={(v) => setHcp(rpId, "medalIda", v)} />
                  <Field label="Medal Vuelta" value={h.medalVuelta} onChange={(v) => setHcp(rpId, "medalVuelta", v)} />
                  <Field
                    label="Stableford (=Match)"
                    value={h.stableford}
                    onChange={(v) => setHcp(rpId, "stableford", v)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "BETS" && (
          <div className="space-y-3">
            <p className="text-[10px] text-[var(--muted)]">
              Total (grande) e Ida/Vuelta (chicos, mismo valor cada uno).
            </p>
            {(["MATCH", "MEDAL", "STABLEFORD"] as FamilyKey[]).map((fam) => {
              const f = bets[fam];
              return (
                <div key={fam} className="gf-card !p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => setBetField(fam, "enabled", e.target.checked)}
                    />
                    <span className="font-semibold">
                      {fam === "MATCH" ? "Match" : fam === "MEDAL" ? "Medal" : "Stableford"}
                    </span>
                  </label>
                  {f.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <Field
                        label="Total"
                        value={f.total}
                        onChange={(v) => setBetField(fam, "total", v)}
                        money
                      />
                      <Field
                        label="Ida y Vuelta c/u"
                        value={f.leg}
                        onChange={(v) => setBetField(fam, "leg", v)}
                        money
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 sticky bottom-0 bg-[var(--sand)] pt-2">
          <button onClick={onClose} className="gf-btn gf-btn-secondary flex-1" disabled={busy}>
            Cancelar
          </button>
          <button onClick={save} className="gf-btn flex-1" disabled={busy}>
            {busy ? "Guardando..." : "💾 Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  decimal = false,
  money = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  money?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </label>
      <input
        type="number"
        inputMode={decimal || money ? "decimal" : "numeric"}
        step={decimal || money ? "0.1" : "1"}
        className="gf-input mt-0.5 text-center"
        value={value}
        placeholder={money ? "$" : "—"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
