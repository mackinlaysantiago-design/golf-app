"use client";

import { useState } from "react";
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<Mode>("SOLO");
  const [selectedPlayers, setSelectedPlayers] = useState<{ id: string; hcp: string }[]>(
    me ? [{ id: me.id, hcp: me.hcpIndex?.toString() ?? "" }] : [],
  );
  const [pairs, setPairs] = useState<string>("solo"); // "solo" | "individual" | "parejas"
  const [enterSzYds, setEnterSzYds] = useState(50);
  const [downInSzStrokes, setDownInSzStrokes] = useState(3);
  const [onePuttCircleFt, setOnePuttCircleFt] = useState(6);
  const [twoPuttCircleYds, setTwoPuttCircleYds] = useState(20);
  const [busy, setBusy] = useState(false);

  const requiredCount = MODE_PLAYERS[mode];
  const ready = selectedPlayers.length === requiredCount && selectedPlayers.every((p) => p.id);

  function setPlayerSlot(idx: number, playerId: string) {
    const player = players.find((p) => p.id === playerId);
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[idx] = { id: playerId, hcp: player?.hcpIndex?.toString() ?? "" };
      return next;
    });
  }

  function setPlayerHcp(idx: number, hcp: string) {
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], hcp };
      return next;
    });
  }

  function changeMode(newMode: Mode) {
    setMode(newMode);
    const target = MODE_PLAYERS[newMode];
    setSelectedPlayers((prev) => {
      const next = [...prev];
      while (next.length < target)
        next.push({ id: "", hcp: "" });
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
      enterSzYds,
      downInSzStrokes,
      onePuttCircleFt,
      twoPuttCircleYds,
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
          {[1, 2, 3, 4].map((s) => (
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
            <Card key={i} className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Jugador {i + 1}
                {mode === "FOUR_P" && pairs === "parejas" && (
                  <span className="ml-2">
                    {i < 2 ? <Pill>Pareja A</Pill> : <Pill variant="accent">Pareja B</Pill>}
                  </span>
                )}
              </div>
              <select
                className="gf-input"
                value={selectedPlayers[i]?.id ?? ""}
                onChange={(e) => setPlayerSlot(i, e.target.value)}
              >
                <option value="">— Elegir —</option>
                {players.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={selectedPlayers.some((sp, idx) => sp.id === p.id && idx !== i)}
                  >
                    {p.name}
                    {p.isMe ? " (yo)" : ""}
                  </option>
                ))}
              </select>
              <input
                className="gf-input"
                placeholder="HCP del día (ej 8.9)"
                inputMode="decimal"
                value={selectedPlayers[i]?.hcp ?? ""}
                onChange={(e) => setPlayerHcp(i, e.target.value)}
              />
            </Card>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="gf-btn gf-btn-secondary flex-1"
            >
              Volver
            </button>
            <button
              onClick={() => setStep(4)}
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
          <SectionHeader>Niveles Scoring Method</SectionHeader>
          <Card className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Enter SZ (yds al hoyo)
              </label>
              <input
                type="number"
                className="gf-input mt-1"
                value={enterSzYds}
                onChange={(e) => setEnterSzYds(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Down in SZ (golpes desde SZ)
              </label>
              <input
                type="number"
                className="gf-input mt-1"
                value={downInSzStrokes}
                onChange={(e) => setDownInSzStrokes(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                1-putt circle (ft)
              </label>
              <input
                type="number"
                className="gf-input mt-1"
                value={onePuttCircleFt}
                onChange={(e) => setOnePuttCircleFt(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
                2-putt circle (yds)
              </label>
              <input
                type="number"
                className="gf-input mt-1"
                value={twoPuttCircleYds}
                onChange={(e) => setTwoPuttCircleYds(parseInt(e.target.value) || 0)}
              />
            </div>
          </Card>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(3)}
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
