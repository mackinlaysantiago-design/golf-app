"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";

type Player = { id: string; name: string; hcpIndex: number | null; isMe: boolean };
type Course = { id: string; name: string; holes: { number: number; par: number; hcpHoyo: number }[] };

type Mode = "SOLO" | "TWO_P" | "THREE_P" | "FOUR_P";

const MODE_LABEL: Record<Mode, string> = {
  SOLO: "Solo",
  TWO_P: "2 jugadores",
  THREE_P: "3 jugadores",
  FOUR_P: "4 jugadores",
};

const MODE_PLAYERS: Record<Mode, number> = {
  SOLO: 1,
  TWO_P: 2,
  THREE_P: 3,
  FOUR_P: 4,
};

export default function NuevaRondaClient({
  courses,
  players,
}: {
  courses: Course[];
  players: Player[];
}) {
  const router = useRouter();

  const me = players.find((p) => p.isMe);
  const today = new Date().toISOString().slice(0, 10);
  const [allPlayers, setAllPlayers] = useState<Player[]>(players);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<Mode>("SOLO");
  const [modality, setModality] = useState("MEDAL");
  const [tee, setTee] = useState("BLANCO");
  const [selectedPlayers, setSelectedPlayers] = useState<{ id: string; hcp: string; courseHcp: string }[]>(
    me ? [{ id: me.id, hcp: me.hcpIndex?.toString() ?? "", courseHcp: "" }] : [],
  );
  const [pairs, setPairs] = useState<string>("solo"); // "solo" | "individual" | "parejas"
  // Defaults pre-fill desde Player.isMe (niveles que va subiendo con cada perfect run)
  const [enterSzYds, setEnterSzYds] = useState(50);
  const [downInSzStrokes, setDownInSzStrokes] = useState("3");
  const [onePuttCircleFt, setOnePuttCircleFt] = useState("6");
  const [twoPuttCircleYds, setTwoPuttCircleYds] = useState("20");

  useEffect(() => {
    if (!me) return;
    Promise.all([
      fetch(`/api/jugadores/${me.id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/pp/levels").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([p, ppLevels]) => {
        if (p) {
          if (typeof p.enterSzYds === "number") setEnterSzYds(p.enterSzYds);
          if (typeof p.downInSzStrokes === "number")
            setDownInSzStrokes(String(p.downInSzStrokes));
        }
        // 1-Putt y 2-Putt: usar el más estricto entre Player.X y nivel del drill PP
        const playerOpc = typeof p?.onePuttCircleFt === "number" ? p.onePuttCircleFt : 6;
        const ppOpc = ppLevels?.ONE_PUTT_CIRCLE?.currentDistance;
        const opc = typeof ppOpc === "number" && ppOpc > 0 ? Math.min(playerOpc, ppOpc) : playerOpc;
        setOnePuttCircleFt(String(opc));

        // 2-Putt drill PP está en ft → convertir a yds (1 yd = 3 ft)
        const playerTpc = typeof p?.twoPuttCircleYds === "number" ? p.twoPuttCircleYds : 20;
        const ppTpcFt = ppLevels?.TWO_PUTT_CIRCLE?.currentDistance;
        const ppTpcYds = typeof ppTpcFt === "number" && ppTpcFt > 0 ? Math.round(ppTpcFt / 3) : null;
        const tpc = ppTpcYds != null ? Math.min(playerTpc, ppTpcYds) : playerTpc;
        setTwoPuttCircleYds(String(tpc));
      })
      .catch(() => {});
  }, [me]);
  // Apuestas: por familia (MATCH/MEDAL/STABLEFORD) tenemos enabled + monto Total + monto chico (ida=vuelta)
  type BetFamily = {
    enabled: boolean;
    totalAmount: string;  // valor para MATCH/MEDAL/STABLEFORD (Total)
    legAmount: string;    // valor para Ida y Vuelta (mismo valor para los dos)
  };
  const [betFamilies, setBetFamilies] = useState<Record<"MATCH" | "MEDAL" | "STABLEFORD", BetFamily>>({
    MATCH: { enabled: false, totalAmount: "", legAmount: "" },
    MEDAL: { enabled: false, totalAmount: "", legAmount: "" },
    STABLEFORD: { enabled: false, totalAmount: "", legAmount: "" },
  });
  const [busy, setBusy] = useState(false);

  function toggleFamily(fam: "MATCH" | "MEDAL" | "STABLEFORD") {
    setBetFamilies((prev) => {
      const wasEnabled = prev[fam].enabled;
      const next = { ...prev, [fam]: { ...prev[fam], enabled: !wasEnabled } };

      // Re-elegir modality principal para lookup HCP
      const priority: ("MEDAL" | "STABLEFORD")[] = ["MEDAL", "STABLEFORD"];
      const primaryFam = priority.find((p) => next[p].enabled) ?? "MEDAL";
      const primary = primaryFam; // usar el "Total" para lookup
      if (primary !== modality) {
        setModality(primary);
        selectedPlayers.forEach((p, i) => {
          if (p.hcp) {
            const n = parseFloat(p.hcp);
            if (!isNaN(n)) lookupCourseHcp(i, n);
          }
        });
      }
      return next;
    });
  }
  function setFamilyAmount(fam: "MATCH" | "MEDAL" | "STABLEFORD", field: "totalAmount" | "legAmount", value: string) {
    setBetFamilies((prev) => ({ ...prev, [fam]: { ...prev[fam], [field]: value } }));
  }

  // Expand betFamilies → array de RoundBet entries
  function expandBets(): { modality: string; amount: number; currency: string }[] {
    const out: { modality: string; amount: number; currency: string }[] = [];
    for (const fam of ["MATCH", "MEDAL", "STABLEFORD"] as const) {
      const f = betFamilies[fam];
      if (!f.enabled) continue;
      const total = f.totalAmount ? parseFloat(f.totalAmount) : 0;
      const leg = f.legAmount ? parseFloat(f.legAmount) : 0;
      if (total > 0) out.push({ modality: fam, amount: total, currency: "ARS" });
      if (leg > 0) {
        out.push({ modality: `${fam}_IDA`, amount: leg, currency: "ARS" });
        out.push({ modality: `${fam}_VUELTA`, amount: leg, currency: "ARS" });
      }
    }
    return out;
  }

  const requiredCount = MODE_PLAYERS[mode];
  const ready = selectedPlayers.length === requiredCount && selectedPlayers.every((p) => p.id);

  function setPlayerSlot(idx: number, playerId: string) {
    const player = allPlayers.find((p) => p.id === playerId);
    const newHcp = player?.hcpIndex?.toString() ?? "";
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[idx] = { id: playerId, hcp: newHcp, courseHcp: "" };
      return next;
    });
    if (newHcp && courseId) lookupCourseHcp(idx, parseFloat(newHcp));
  }

  function setPlayerHcp(idx: number, hcp: string) {
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], hcp };
      return next;
    });
    if (hcp && courseId) {
      const idxNum = parseFloat(hcp);
      if (!isNaN(idxNum)) lookupCourseHcp(idx, idxNum);
    }
  }

  function setPlayerCourseHcp(idx: number, courseHcp: string) {
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], courseHcp };
      return next;
    });
  }

  async function lookupCourseHcp(idx: number, indexNum: number) {
    if (!courseId) return;
    try {
      const res = await fetch(
        `/api/canchas/${courseId}/hcp?index=${indexNum}&modality=${modality}&tee=${tee}&category=CAB`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.found && data.courseHcp != null) {
        setSelectedPlayers((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], courseHcp: String(data.courseHcp) };
          return next;
        });
      }
    } catch {}
  }

  function changeMode(newMode: Mode) {
    setMode(newMode);
    const target = MODE_PLAYERS[newMode];
    setSelectedPlayers((prev) => {
      const next = [...prev];
      while (next.length < target)
        next.push({ id: "", hcp: "", courseHcp: "" });
      return next.slice(0, target);
    });
    if (newMode !== "FOUR_P") setPairs("individual");
    else setPairs("individual");
  }

  async function submit() {
    if (!ready || !courseId) return;
    setBusy(true);

    const payload = {
      courseId,
      date: new Date(date).toISOString(),
      mode,
      modality,
      tee,
      enterSzYds,
      downInSzStrokes: parseInt(downInSzStrokes) || 3,
      onePuttCircleFt: parseInt(onePuttCircleFt) || 6,
      twoPuttCircleYds: parseInt(twoPuttCircleYds) || 20,
      bets: expandBets(),
      pairs:
        mode === "FOUR_P" && pairs === "parejas"
          ? [
              [selectedPlayers[0].id, selectedPlayers[1].id],
              [selectedPlayers[2].id, selectedPlayers[3].id],
            ]
          : undefined,
      players: selectedPlayers.map((p, i) => ({
        playerId: p.id,
        hcpIndex: p.hcp ? parseFloat(p.hcp) : null,
        courseHcp: p.courseHcp ? parseInt(p.courseHcp) : null,
        position: i + 1,
      })),
    };

    const res = await fetch("/api/rondas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const round = await res.json();
      router.push(`/rondas/${round.id}`);
      router.refresh();
    } else {
      alert("Error creando ronda");
      setBusy(false);
    }
  }

  if (courses.length === 0) {
    return (
      <div className="px-4 pt-6 pb-4">
        <Card className="text-center">
          <p className="text-sm text-[var(--muted)] mb-3">
            Necesitás cargar una cancha primero
          </p>
          <a href="/jugadores/nueva-cancha" className="gf-btn inline-block">
            Crear cancha
          </a>
        </Card>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="px-4 pt-6 pb-4">
        <Card className="text-center">
          <p className="text-sm text-[var(--muted)] mb-3">
            Necesitás cargar al menos un jugador
          </p>
          <a href="/jugadores" className="gf-btn inline-block">
            Crear jugador
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva ronda</h1>
        <div className="flex gap-2 text-xs mt-1">
          {(mode === "SOLO" ? [1, 2, 3, 5] : [1, 2, 3, 4, 5]).map((s) => (
            <span
              key={s}
              className="gf-pill"
              style={{
                background: step >= s ? "var(--fairway)" : "var(--green-pale)",
                color: step >= s ? "white" : "var(--fairway)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </header>

      {step === 1 && (
        <>
          <SectionHeader>Cancha y fecha</SectionHeader>
          <Card className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Cancha
              </label>
              <select
                className="gf-input mt-1"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Fecha
              </label>
              <input
                type="date"
                className="gf-input mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </Card>
          <button onClick={() => setStep(2)} className="gf-btn w-full">
            Siguiente
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <SectionHeader>Modo de juego</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            {(["SOLO", "TWO_P", "THREE_P", "FOUR_P"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className="text-left"
              >
                <Card
                  className="!p-4"
                  variant={mode === m ? "fairway" : "default"}
                >
                  <div className="font-semibold">{MODE_LABEL[m]}</div>
                  <div className="text-xs opacity-80">
                    {MODE_PLAYERS[m]} jugador{MODE_PLAYERS[m] > 1 ? "es" : ""}
                  </div>
                </Card>
              </button>
            ))}
          </div>
          {mode === "FOUR_P" && (
            <Card>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                Formato 4P
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 gf-btn"
                  style={{
                    background: pairs === "individual" ? "var(--fairway)" : "var(--white)",
                    color: pairs === "individual" ? "white" : "var(--fairway)",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setPairs("individual")}
                >
                  Individual
                </button>
                <button
                  className="flex-1 gf-btn"
                  style={{
                    background: pairs === "parejas" ? "var(--fairway)" : "var(--white)",
                    color: pairs === "parejas" ? "white" : "var(--fairway)",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setPairs("parejas")}
                >
                  Parejas 2v2
                </button>
              </div>
            </Card>
          )}
          <Card>
            <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Tee (para cálculo de Course Hcp)
            </label>
            <select
              className="gf-input mt-1"
              value={tee}
              onChange={(e) => {
                setTee(e.target.value);
                selectedPlayers.forEach((p, i) => {
                  if (p.hcp) {
                    const n = parseFloat(p.hcp);
                    if (!isNaN(n)) lookupCourseHcp(i, n);
                  }
                });
              }}
            >
              <option value="BLANCO">Blanco</option>
              <option value="AZUL">Azul</option>
              <option value="NEGRO">Negro</option>
              <option value="ROJO">Rojo</option>
            </select>
            <p className="text-[10px] text-[var(--muted)] mt-2">
              La modalidad de juego se elige en el siguiente paso (podés marcar varias).
            </p>
          </Card>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="gf-btn gf-btn-secondary flex-1"
            >
              Volver
            </button>
            <button onClick={() => setStep(3)} className="gf-btn flex-1">
              Siguiente
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <SectionHeader>Jugadores · HCP</SectionHeader>
          {Array.from({ length: requiredCount }).map((_, i) => (
            <PlayerSlot
              key={i}
              index={i}
              mode={mode}
              pairs={pairs}
              allPlayers={allPlayers}
              selectedPlayers={selectedPlayers}
              currentSlot={selectedPlayers[i]}
              onPickExisting={(playerId) => setPlayerSlot(i, playerId)}
              onCreateNew={async (name, hcpStr) => {
                const hcpNum = hcpStr ? parseFloat(hcpStr) : null;
                const res = await fetch("/api/jugadores", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, hcpIndex: hcpNum }),
                });
                if (!res.ok) {
                  alert("Error creando jugador");
                  return;
                }
                const newP: Player = await res.json();
                setAllPlayers((prev) => [...prev, newP]);
                setPlayerSlot(i, newP.id);
              }}
              onUpdateHcp={(hcp) => setPlayerHcp(i, hcp)}
              onUpdateCourseHcp={(ch) => setPlayerCourseHcp(i, ch)}
            />
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="gf-btn gf-btn-secondary flex-1"
            >
              Volver
            </button>
            <button
              onClick={() => setStep(mode === "SOLO" ? 5 : 4)}
              className="gf-btn flex-1"
              disabled={!ready}
            >
              Siguiente
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <SectionHeader>Apuestas (opcional)</SectionHeader>
          <Card>
            <p className="text-xs text-[var(--muted)]">
              Marcá las modalidades que jugás. Total (grande) e Ida/Vuelta (chicos, mismo valor cada uno).
              El ganador se lleva el monto × cantidad de jugadores.
            </p>
          </Card>

          {(
            [
              ["MATCH", "Match"],
              ["MEDAL", "Medal"],
              ["STABLEFORD", "Stableford"],
            ] as ["MATCH" | "MEDAL" | "STABLEFORD", string][]
          ).map(([fam, label]) => {
            const f = betFamilies[fam];
            return (
              <Card key={fam} className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={() => toggleFamily(fam)}
                  />
                  <span className="font-semibold">{label}</span>
                </label>
                {f.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Total (grande)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        className="gf-input mt-0.5 text-right"
                        value={f.totalAmount}
                        onChange={(e) => setFamilyAmount(fam, "totalAmount", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Ida y Vuelta (c/u)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        className="gf-input mt-0.5 text-right"
                        value={f.legAmount}
                        onChange={(e) => setFamilyAmount(fam, "legAmount", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(3)}
              className="gf-btn gf-btn-secondary flex-1"
            >
              Volver
            </button>
            <button onClick={() => setStep(5)} className="gf-btn flex-1">
              Siguiente
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <SectionHeader>Niveles Scoring Method</SectionHeader>
          <Card className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Enter SZ
              </label>
              <select
                className="gf-input mt-1"
                value={enterSzYds}
                onChange={(e) => setEnterSzYds(parseInt(e.target.value))}
              >
                <option value={0}>GIR (en green)</option>
                <option value={25}>≤ 25 yds</option>
                <option value={50}>≤ 50 yds</option>
                <option value={100}>≤ 100 yds</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Down in SZ (golpes desde SZ)
              </label>
              <input
                type="number"
                inputMode="numeric"
                className="gf-input mt-1"
                value={downInSzStrokes}
                onChange={(e) => setDownInSzStrokes(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                1-putt circle (ft)
              </label>
              <input
                type="number"
                inputMode="numeric"
                className="gf-input mt-1"
                value={onePuttCircleFt}
                onChange={(e) => setOnePuttCircleFt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                2-putt circle (yds)
              </label>
              <input
                type="number"
                inputMode="numeric"
                className="gf-input mt-1"
                value={twoPuttCircleYds}
                onChange={(e) => setTwoPuttCircleYds(e.target.value)}
              />
            </div>
          </Card>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(mode === "SOLO" ? 3 : 4)}
              className="gf-btn gf-btn-secondary flex-1"
            >
              Volver
            </button>
            <button onClick={submit} disabled={busy} className="gf-btn flex-1">
              {busy ? "Creando..." : "Empezar ronda"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerSlot({
  index,
  mode,
  pairs,
  allPlayers,
  selectedPlayers,
  currentSlot,
  onPickExisting,
  onCreateNew,
  onUpdateHcp,
  onUpdateCourseHcp,
}: {
  index: number;
  mode: Mode;
  pairs: string;
  allPlayers: Player[];
  selectedPlayers: { id: string; hcp: string; courseHcp: string }[];
  currentSlot: { id: string; hcp: string; courseHcp: string } | undefined;
  onPickExisting: (playerId: string) => void;
  onCreateNew: (name: string, hcp: string) => Promise<void>;
  onUpdateHcp: (hcp: string) => void;
  onUpdateCourseHcp: (ch: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHcp, setNewHcp] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPlayer = currentSlot?.id
    ? allPlayers.find((p) => p.id === currentSlot.id)
    : null;

  const usedIds = new Set(
    selectedPlayers.map((sp, i) => (i !== index ? sp.id : null)).filter(Boolean) as string[],
  );

  const matches = search
    ? allPlayers.filter(
        (p) =>
          !usedIds.has(p.id) &&
          p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : allPlayers.filter((p) => !usedIds.has(p.id));

  const exactMatch = matches.find(
    (p) => p.name.toLowerCase() === search.toLowerCase(),
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    await onCreateNew(newName.trim(), newHcp);
    setBusy(false);
    setCreatingNew(false);
    setNewName("");
    setNewHcp("");
    setSearch("");
  }

  return (
    <Card className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        Jugador {index + 1}
        {mode === "FOUR_P" && pairs === "parejas" && (
          <span className="ml-2">
            {index < 2 ? <Pill>Pareja A</Pill> : <Pill variant="accent">Pareja B</Pill>}
          </span>
        )}
      </div>

      {selectedPlayer ? (
        <div className="flex justify-between items-center gap-2">
          <div className="flex-1">
            <div className="font-semibold">
              {selectedPlayer.name}
              {selectedPlayer.isMe && (
                <span className="ml-2"><Pill variant="accent">YO</Pill></span>
              )}
            </div>
            {selectedPlayer.hcpIndex != null && (
              <div className="text-[10px] text-[var(--muted)] gf-mono">
                Index guardado: {selectedPlayer.hcpIndex.toFixed(1)}
              </div>
            )}
          </div>
          <button
            type="button"
            className="text-xs text-[var(--red)]"
            onClick={() => {
              onPickExisting("");
              setSearch("");
            }}
          >
            Cambiar
          </button>
        </div>
      ) : creatingNew ? (
        <div className="space-y-2">
          <input
            className="gf-input"
            placeholder="Nombre nuevo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            className="gf-input"
            placeholder="HCP Index (opcional)"
            inputMode="decimal"
            value={newHcp}
            onChange={(e) => setNewHcp(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="gf-btn gf-btn-secondary flex-1"
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !newName.trim()}
              className="gf-btn flex-1"
            >
              {busy ? "Guardando..." : "Crear y usar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            className="gf-input"
            placeholder="Buscar o tipear nombre..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {showSuggestions && (
            <div className="mt-1 max-h-48 overflow-y-auto border border-[var(--border)] rounded-xl bg-white">
              {matches.slice(0, 6).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--green-pale)] border-b border-[var(--green-pale)] last:border-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPickExisting(p.id);
                    setSearch("");
                    setShowSuggestions(false);
                  }}
                >
                  <span className="text-sm">
                    {p.name}
                    {p.isMe ? " (yo)" : ""}
                  </span>
                  {p.hcpIndex != null && (
                    <span className="ml-2 text-[10px] gf-mono text-[var(--muted)]">
                      idx {p.hcpIndex.toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
              {search && !exactMatch && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-[var(--accent-light)] text-[var(--fairway)] font-semibold text-sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewName(search);
                    setCreatingNew(true);
                    setShowSuggestions(false);
                  }}
                >
                  + Crear &quot;{search}&quot;
                </button>
              )}
              {!search && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-[var(--accent-light)] text-[var(--fairway)] font-semibold text-sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCreatingNew(true);
                    setShowSuggestions(false);
                  }}
                >
                  + Nuevo jugador
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selectedPlayer && (
        <>
          <input
            className="gf-input"
            placeholder="Handicap Index (ej 8.9)"
            inputMode="decimal"
            value={currentSlot?.hcp ?? ""}
            onChange={(e) => onUpdateHcp(e.target.value)}
            onBlur={async (e) => {
              const v = e.target.value;
              if (!selectedPlayer || !v) return;
              const num = parseFloat(v);
              if (isNaN(num)) return;
              if (selectedPlayer.hcpIndex === num) return;
              await fetch(`/api/jugadores/${selectedPlayer.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hcpIndex: num }),
              });
            }}
          />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Course Hcp del día (auto si la cancha tiene tabla)
            </label>
            <input
              className="gf-input mt-0.5"
              placeholder="ej 6"
              inputMode="numeric"
              value={currentSlot?.courseHcp ?? ""}
              onChange={(e) => onUpdateCourseHcp(e.target.value)}
            />
          </div>
        </>
      )}
    </Card>
  );
}
