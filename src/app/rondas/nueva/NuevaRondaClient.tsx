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
  const [courseId, setCourseId] = useState<string>(() => {
    const lucila = courses.find((c) => /lucila/i.test(c.name));
    return lucila?.id ?? courses[0]?.id ?? "";
  });
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<Mode>("SOLO");
  const [modality, setModality] = useState("MEDAL");
  const [tee, setTee] = useState("BLANCO");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [nineWhich, setNineWhich] = useState<"IDA" | "VUELTA">("IDA");
  // Cuando cambian holesPlayed/nineWhich, actualizar la modalidad principal
  useEffect(() => {
    setModality((prev) => {
      const base = prev.replace(/_IDA$|_VUELTA$/, "");
      return holesPlayed === 9 ? `${base}_${nineWhich}` : base;
    });
    // Recalcular CH con la nueva modalidad
    selectedPlayers.forEach((p, i) => {
      if (p.hcp) {
        const n = parseFloat(p.hcp);
        if (!isNaN(n)) lookupCourseHcp(i, n);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holesPlayed, nineWhich]);
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
  // Partidos: por familia (MATCH/MEDAL/STABLEFORD) marcás qué tramos se juegan.
  // Sin plata: cada tramo ganado vale 1 punto (se muestra en el resumen).
  type BetFamily = {
    enabled: boolean;
    total: boolean; // se juega el Total (grande)
    legs: boolean;  // se juegan Ida y Vuelta (chicos)
  };
  const [betFamilies, setBetFamilies] = useState<Record<"MATCH" | "MEDAL" | "STABLEFORD", BetFamily>>({
    MATCH: { enabled: false, total: true, legs: true },
    MEDAL: { enabled: false, total: true, legs: true },
    STABLEFORD: { enabled: false, total: true, legs: true },
  });
  const [busy, setBusy] = useState(false);

  function toggleFamily(fam: "MATCH" | "MEDAL" | "STABLEFORD") {
    setBetFamilies((prev) => {
      const wasEnabled = prev[fam].enabled;
      const next = { ...prev, [fam]: { ...prev[fam], enabled: !wasEnabled } };

      // Re-elegir modality principal para lookup HCP
      const priority: ("MEDAL" | "STABLEFORD")[] = ["MEDAL", "STABLEFORD"];
      const primaryFam = priority.find((p) => next[p].enabled) ?? "MEDAL";
      // Si juega 9 hoyos, usar la modalidad de ida o vuelta correspondiente
      const primary = holesPlayed === 9
        ? `${primaryFam}_${nineWhich}`
        : primaryFam;
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
  function setFamilyTramo(fam: "MATCH" | "MEDAL" | "STABLEFORD", field: "total" | "legs", value: boolean) {
    setBetFamilies((prev) => ({ ...prev, [fam]: { ...prev[fam], [field]: value } }));
  }

  // Expand betFamilies → array de RoundBet entries. Sin plata: amount=1 (1 punto por tramo).
  // En 9 hoyos solo creamos la modalidad de la sección jugada (Total y la otra mitad no aplican).
  function expandBets(): { modality: string; amount: number; currency: string }[] {
    const out: { modality: string; amount: number; currency: string }[] = [];
    const is9 = holesPlayed === 9;
    for (const fam of ["MATCH", "MEDAL", "STABLEFORD"] as const) {
      const f = betFamilies[fam];
      if (!f.enabled) continue;
      if (is9) {
        if (f.total || f.legs) {
          out.push({ modality: `${fam}_${nineWhich}`, amount: 1, currency: "PTS" });
        }
        continue;
      }
      if (f.total) out.push({ modality: fam, amount: 1, currency: "PTS" });
      if (f.legs) {
        out.push({ modality: `${fam}_IDA`, amount: 1, currency: "PTS" });
        out.push({ modality: `${fam}_VUELTA`, amount: 1, currency: "PTS" });
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
      holesPlayed,
      nineWhich: holesPlayed === 9 ? nineWhich : null,
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
      // Solo si YO juego: paso por el briefing pre-ronda. Si no, va directo al tracker.
      const meIsPlaying = me && selectedPlayers.some((p) => p.id === me.id);
      router.push(meIsPlaying ? `/rondas/${round.id}/briefing` : `/rondas/${round.id}`);
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

          <Card>
            <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Hoyos a jugar
            </label>
            <div className="flex gap-2 mt-1">
              {([18, 9] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="flex-1 gf-btn"
                  style={{
                    background: holesPlayed === n ? "var(--fairway)" : "var(--white)",
                    color: holesPlayed === n ? "white" : "var(--fairway)",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setHolesPlayed(n)}
                >
                  {n} hoyos
                </button>
              ))}
            </div>
            {holesPlayed === 9 && (
              <div className="flex gap-2 mt-2">
                {(["IDA", "VUELTA"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    className="flex-1 gf-btn"
                    style={{
                      background: nineWhich === w ? "var(--fairway)" : "var(--white)",
                      color: nineWhich === w ? "white" : "var(--fairway)",
                      border: "1px solid var(--border)",
                    }}
                    onClick={() => setNineWhich(w)}
                  >
                    {w === "IDA" ? "Ida (1-9)" : "Vuelta (10-18)"}
                  </button>
                ))}
              </div>
            )}
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
          <SectionHeader>Partidos (opcional)</SectionHeader>
          <Card>
            <p className="text-xs text-[var(--muted)]">
              Marcá las modalidades y tramos que juegan. Cada tramo ganado vale{" "}
              <strong>1 punto</strong> — los puntos se ven en el resumen.
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
                {f.enabled && holesPlayed === 18 && (
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={f.total}
                        onChange={(e) => setFamilyTramo(fam, "total", e.target.checked)}
                      />
                      Total (grande)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={f.legs}
                        onChange={(e) => setFamilyTramo(fam, "legs", e.target.checked)}
                      />
                      Ida y Vuelta (chicos)
                    </label>
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
          <SectionHeader>Goals del día (Scoring Method)</SectionHeader>
          <Card className="space-y-4">
            <p className="text-xs text-[var(--muted)]">
              Dos metas <strong>independientes</strong> que se trackean por separado en cada hoyo.
              Elegí el nivel que te exija pero no te frustre.
            </p>

            {/* Goal 1: Enter SZ */}
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--fairway)] mb-1">
                ① Enter Scoring Zone · qué tan cerca tenés que llegar
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "100 yds", value: 100, hint: "Llegar con un wedge" },
                  { label: "50 yds", value: 50, hint: "Pitching range" },
                  { label: "25 yds", value: 25, hint: "Chip range" },
                  { label: "GIR", value: 0, hint: "On the green" },
                ].map((g) => {
                  const isSelected = enterSzYds === g.value;
                  return (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setEnterSzYds(g.value)}
                      className="rounded-lg p-2 text-center"
                      style={{
                        background: isSelected ? "var(--fairway)" : "var(--green-pale)",
                        color: isSelected ? "white" : "var(--fairway)",
                      }}
                      title={g.hint}
                    >
                      <div className="gf-display text-lg font-bold leading-none">{g.label}</div>
                      <div className="text-[9px] mt-1 opacity-80 leading-tight">{g.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goal 2: Down in SZ */}
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--fairway)] mb-1">
                ② Down in Scoring Zone · golpes para terminar desde ahí
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "3 golpes", value: 3, hint: "Chip + 2 putts = bogey" },
                  { label: "2 golpes", value: 2, hint: "Up & down = par" },
                  { label: "1 golpe", value: 1, hint: "Chip-in / 1 putt desde GIR = birdie" },
                ].map((g) => {
                  const isSelected = parseInt(downInSzStrokes) === g.value;
                  return (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setDownInSzStrokes(String(g.value))}
                      className="rounded-lg p-2 text-center"
                      style={{
                        background: isSelected ? "var(--fairway)" : "var(--green-pale)",
                        color: isSelected ? "white" : "var(--fairway)",
                      }}
                      title={g.hint}
                    >
                      <div className="gf-display text-lg font-bold leading-none">{g.label}</div>
                      <div className="text-[9px] mt-1 opacity-80 leading-tight">{g.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-md bg-[var(--accent-light)] px-2 py-1.5 text-[10px] text-[var(--accent)]">
              <strong>Tu combinación actual:</strong>{" "}
              {enterSzYds === 0 ? "GIR" : `≤${enterSzYds} yds`} · Down in {downInSzStrokes}.
              {enterSzYds === 0 && downInSzStrokes === "2" && " (Par desde green)"}
              {enterSzYds === 0 && downInSzStrokes === "1" && " (Birdie 🦅)"}
              {enterSzYds === 25 && downInSzStrokes === "2" && " (Up & down desde chip range)"}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--muted)]">
                Ajuste avanzado de putts (1PC / 2PC)
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    1-putt circle (ft)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="gf-input mt-0.5"
                    value={onePuttCircleFt}
                    onChange={(e) => setOnePuttCircleFt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    2-putt circle (yds)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="gf-input mt-0.5"
                    value={twoPuttCircleYds}
                    onChange={(e) => setTwoPuttCircleYds(e.target.value)}
                  />
                </div>
              </div>
            </details>
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
