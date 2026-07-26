"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { computeHoleFlags } from "@/lib/scoring-method";
import { strokesPerHole, stablefordPoints } from "@/lib/handicap";
import EditarSetupModal from "./EditarSetupModal";
import ScoreMark from "@/components/ui/ScoreMark";
import { SM_KEYS } from "@/lib/sm-keys";
import {
  findGoalByConfig,
  findGoalByLabel,
  ENTRY_OPTIONS,
  DOWN_OPTIONS,
  relaxEntry,
  relaxDown,
  holeDiagnostic,
} from "@/lib/sm-goals";
import { readCurrentHole, writeCurrentHole } from "@/lib/currentHole";

type Hole = {
  number: number;
  par: number;
  hcpHoyo: number;
  yards: number | null;
};

type RoundHoleData = {
  id: string;
  holeNumber: number;
  strokesToEnterSz: number | null;
  distanceInRegYds: number | null;
  strokesInsideSz: number | null;
  putts: number | null;
  firstPuttDistanceFt: number | null;
  puttMadeDistanceFt: number | null;
  puttsInside1PuttCircle: number | null;
  score: number | null;
  penaltyStrokes: number | null;
  keysBroken: unknown; // JsonValue desde Prisma — se cast a number[] al usar
  targetGoal: string | null;
  pinColor: string | null;
  dangerSide: string | null;
  aimedAtCenter: boolean | null;
  recoveryMode: boolean | null;
};

type RoundPlayer = {
  id: string;
  position: number;
  hcpIndex: number | null;
  courseHcp: number | null;
  modalityHcps?: unknown;
  player: { id: string; name: string; isMe: boolean };
  holes: RoundHoleData[];
};

type Round = {
  id: string;
  date: Date;
  mode: string;
  courseId: string;
  tee: string;
  holesPlayed: number;
  nineWhich: string | null;
  closedAt: Date | null;
  enterSzYds: number;
  downInSzStrokes: number;
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
  pairs: string | null;
  course: { id: string; name: string; holes: Hole[] };
  players: RoundPlayer[];
  bets: { modality: string; amount: number; currency: string }[];
};

type FieldKey =
  | "strokesToEnterSz"
  | "distanceInRegYds"
  | "strokesInsideSz"
  | "putts"
  | "firstPuttDistanceFt"
  | "puttMadeDistanceFt"
  | "puttsInside1PuttCircle"
  | "score"
  | "penaltyStrokes";

export default function RondaTracker({
  round,
}: {
  round: Round;
}) {
  const router = useRouter();
  // currentHole persiste en localStorage por roundId (compartido con GPS view).
  const [currentHole, setCurrentHole] = useState(() => {
    const stored = readCurrentHole(round.id);
    if (stored != null) return stored;
    return round.holesPlayed === 9 && round.nineWhich === "VUELTA" ? 10 : 1;
  });
  useEffect(() => {
    writeCurrentHole(round.id, currentHole);
  }, [round.id, currentHole]);
  const [busy, setBusy] = useState(false);

  // Ref para scroll automático al cambiar de hoyo (touch "siguiente" abajo
  // → vuelve al header del hoyo arriba)
  const holeHeaderRef = useRef<HTMLDivElement>(null);
  // Track de cambios — evitar scroll en mount inicial
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    holeHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentHole]);

  // Estado local: { roundPlayerId: { holeNumber: { field: value } } }
  type CellValues = Partial<Record<FieldKey, number | null>> & {
    keysBroken?: number[] | null;
    targetGoal?: string | null;
    pinColor?: "GREEN" | "YELLOW" | "RED" | null;
    dangerSide?: "L" | "R" | "NONE" | null;
    aimedAtCenter?: boolean | null;
    recoveryMode?: boolean | null;
  };
  type CellState = Record<string, Record<number, CellValues>>;

  const initial: CellState = useMemo(() => {
    const out: CellState = {};
    for (const rp of round.players) {
      out[rp.id] = {};
      for (const h of rp.holes) {
        out[rp.id][h.holeNumber] = {
          strokesToEnterSz: h.strokesToEnterSz,
          distanceInRegYds: h.distanceInRegYds,
          strokesInsideSz: h.strokesInsideSz,
          putts: h.putts,
          firstPuttDistanceFt: h.firstPuttDistanceFt,
          puttMadeDistanceFt: h.puttMadeDistanceFt,
          puttsInside1PuttCircle: h.puttsInside1PuttCircle,
          score: h.score,
          penaltyStrokes: h.penaltyStrokes,
          keysBroken: Array.isArray(h.keysBroken) ? (h.keysBroken as number[]) : null,
          targetGoal: h.targetGoal,
          pinColor: (h.pinColor as "GREEN" | "YELLOW" | "RED" | null) ?? null,
          dangerSide: (h.dangerSide as "L" | "R" | "NONE" | null) ?? null,
          aimedAtCenter: h.aimedAtCenter,
          recoveryMode: h.recoveryMode,
        };
      }
    }
    return out;
  }, [round.players]);

  const [data, setData] = useState<CellState>(initial);
  // Scorecard live: abierta por default si la ronda ya tiene scores cargados.
  // Si recién arrancás (0 scores), arranca cerrada para no agregar ruido.
  const hasAnyScore = round.players.some((rp) =>
    rp.holes.some((h) => h.score != null && h.score > 0),
  );
  const [scorecardOpen, setScorecardOpen] = useState(hasAnyScore);
  const [setupOpen, setSetupOpen] = useState(false);
  // Toggle expand SM stats por jugador en el hoyo actual
  const [smExpanded, setSmExpanded] = useState<Record<string, boolean>>({});
  function toggleSm(rpId: string) {
    setSmExpanded((prev) => ({ ...prev, [rpId]: !prev[rpId] }));
  }
  function hasSmDataInHole(rpId: string, hole: number): boolean {
    const c = data[rpId]?.[hole];
    if (!c) return false;
    return (
      c.strokesToEnterSz != null ||
      c.distanceInRegYds != null ||
      c.strokesInsideSz != null ||
      c.putts != null ||
      c.firstPuttDistanceFt != null ||
      c.puttMadeDistanceFt != null ||
      c.puttsInside1PuttCircle != null ||
      c.penaltyStrokes != null ||
      (Array.isArray(c.keysBroken) && c.keysBroken.length > 0) ||
      c.targetGoal != null ||
      c.pinColor != null ||
      c.dangerSide != null ||
      c.aimedAtCenter != null ||
      c.recoveryMode != null
    );
  }

  const meRP = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  const isSolo = round.mode === "SOLO";
  // Filtrar hoyos según 9 (Ida 1-9 o Vuelta 10-18) o 18 completos
  const allCourseHoles = round.course.holes;
  const courseHoles = round.holesPlayed === 9
    ? (round.nineWhich === "VUELTA"
        ? allCourseHoles.filter((h) => h.number >= 10)
        : allCourseHoles.filter((h) => h.number <= 9))
    : allCourseHoles;
  const minHole = courseHoles[0]?.number ?? 1;
  const maxHole = courseHoles[courseHoles.length - 1]?.number ?? 18;
  const currentHoleInfo = courseHoles.find((h) => h.number === currentHole);

  function setDecade(
    rpId: string,
    hole: number,
    field: "pinColor" | "dangerSide" | "aimedAtCenter" | "recoveryMode",
    value: string | boolean | null,
  ) {
    setData((prev) => {
      const cur = prev[rpId]?.[hole] ?? {};
      return {
        ...prev,
        [rpId]: { ...prev[rpId], [hole]: { ...cur, [field]: value } },
      };
    });
  }

  function setTargetGoal(rpId: string, hole: number, goal: string | null) {
    setData((prev) => {
      const cur = prev[rpId]?.[hole] ?? {};
      return {
        ...prev,
        [rpId]: { ...prev[rpId], [hole]: { ...cur, targetGoal: goal } },
      };
    });
  }

  function toggleKey(rpId: string, hole: number, keyId: number) {
    setData((prev) => {
      const cur = prev[rpId]?.[hole] ?? {};
      const existing = cur.keysBroken ?? [];
      const next = existing.includes(keyId)
        ? existing.filter((k) => k !== keyId)
        : [...existing, keyId].sort((a, b) => a - b);
      return {
        ...prev,
        [rpId]: { ...prev[rpId], [hole]: { ...cur, keysBroken: next.length > 0 ? next : null } },
      };
    });
  }

  function setCell(rpId: string, hole: number, field: FieldKey, value: string) {
    const num = value === "" ? null : parseInt(value);
    setData((prev) => {
      const cur = prev[rpId]?.[hole] ?? {};
      const updated = { ...cur, [field]: num };

      // Auto-cálculo del score para el jugador main: strokesToEnterSz + strokesInsideSz
      const isMainPlayer = rpId === meRP.id;
      if (
        isMainPlayer &&
        (field === "strokesToEnterSz" || field === "strokesInsideSz")
      ) {
        const a = field === "strokesToEnterSz" ? num : updated.strokesToEnterSz;
        const b = field === "strokesInsideSz" ? num : updated.strokesInsideSz;
        if (a != null && b != null) {
          updated.score = a + b;
        }
      }

      return {
        ...prev,
        [rpId]: { ...prev[rpId], [hole]: updated },
      };
    });
  }

  async function saveAll() {
    setBusy(true);
    const entries = round.players.flatMap((rp) =>
      Object.entries(data[rp.id] ?? {}).map(([h, fields]) => ({
        roundPlayerId: rp.id,
        holeNumber: parseInt(h),
        ...fields,
      })),
    );
    const res = await fetch(`/api/rondas/${round.id}/hoyos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) alert("Error guardando");
    setBusy(false);
    router.refresh();
  }

  // Leaderboard live
  const courseHcpMap = courseHoles.map((h) => ({ number: h.number, par: h.par, hcpHoyo: h.hcpHoyo }));

  // Modalidades activas según las apuestas configuradas en el wizard.
  // Mostramos solo las columnas correspondientes. "Bruto" siempre se muestra como referencia.
  const betModalities = new Set(round.bets.map((b) => b.modality));
  const showMedal = ["MEDAL", "MEDAL_IDA", "MEDAL_VUELTA"].some((m) =>
    betModalities.has(m),
  );
  const showStbl = ["STABLEFORD", "STABLEFORD_IDA", "STABLEFORD_VUELTA"].some(
    (m) => betModalities.has(m),
  );
  const showMatch = ["MATCH", "MATCH_IDA", "MATCH_VUELTA"].some((m) =>
    betModalities.has(m),
  );

  type LBSection = "TOTAL" | "IDA" | "VUELTA";
  const [lbSection, setLbSection] = useState<LBSection>(
    round.holesPlayed === 9
      ? round.nineWhich === "VUELTA"
        ? "VUELTA"
        : "IDA"
      : "TOTAL",
  );

  function holesForSection(sec: LBSection) {
    if (sec === "IDA") return courseHoles.filter((h) => h.number <= 9);
    if (sec === "VUELTA") return courseHoles.filter((h) => h.number >= 10);
    return courseHoles;
  }

  // Para Medal: usa CH específico de la sección. Para Stbl: usa Stableford CH.
  function chForRpSection(rp: typeof round.players[number], sec: LBSection): { medalCh: number; stblCh: number } {
    const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
    const fallback = rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
    const medalCh = sec === "IDA"
      ? mh?.MEDAL_IDA ?? fallback
      : sec === "VUELTA"
      ? mh?.MEDAL_VUELTA ?? fallback
      : mh?.MEDAL ?? fallback;
    const stblCh = mh?.STABLEFORD ?? fallback;
    return { medalCh, stblCh };
  }

  function computeStandingsForSection(sec: LBSection) {
    const sectionHoles = holesForSection(sec);
    return round.players.map((rp) => {
      const { medalCh, stblCh } = chForRpSection(rp, sec);
      const medalStrokes = strokesPerHole(medalCh, courseHcpMap);
      const stblStrokes = strokesPerHole(stblCh, courseHcpMap);
      let bruto = 0;
      let neto = 0;
      let stbl = 0;
      let played = 0;
      for (const h of sectionHoles) {
        const score = data[rp.id]?.[h.number]?.score;
        if (score != null && score > 0) {
          bruto += score;
          neto += score - (medalStrokes[h.number] ?? 0);
          stbl += stablefordPoints(h.par, score, stblStrokes[h.number] ?? 0);
          played++;
        }
      }
      return {
        rp,
        hcp: medalCh,
        bruto,
        neto,
        stableford: stbl,
        holesPlayed: played,
      };
    });
  }

  const standings = computeStandingsForSection(lbSection);

  // Parsing de parejas (4P 2v2)
  type PairStanding = {
    label: string;
    playerNames: string[];
    matchPoints: number; // BB+WB acumulados
    medalSum: number;    // suma de netos de los dos
    stbl: number;        // stableford acumulado
    holesPlayed: number;
  };
  let pairsStandings: [PairStanding, PairStanding] | null = null;
  if (round.mode === "FOUR_P" && round.pairs) {
    try {
      const pairsJSON: string[][] = JSON.parse(round.pairs);
      if (pairsJSON.length === 2 && pairsJSON.every((p) => p.length === 2)) {
        // Map player.id -> RoundPlayer
        const rpByPlayerId = new Map(round.players.map((rp) => [rp.player.id, rp]));
        const pairAR = pairsJSON[0].map((pid) => rpByPlayerId.get(pid)!).filter(Boolean);
        const pairBR = pairsJSON[1].map((pid) => rpByPlayerId.get(pid)!).filter(Boolean);

        if (pairAR.length === 2 && pairBR.length === 2) {
          let matchA = 0;
          let matchB = 0;
          let medalA = 0;
          let medalB = 0;
          let stblA = 0;
          let stblB = 0;
          let played = 0;

          const sectionHoles = holesForSection(lbSection);
          for (const h of sectionHoles) {
            // Match usa HCP Stableford
            const netsForPairMatch = (rps: typeof pairAR) =>
              rps
                .map((rp) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return null;
                  const { stblCh } = chForRpSection(rp, lbSection);
                  const strokes = strokesPerHole(stblCh, courseHcpMap)[h.number] ?? 0;
                  return sc - strokes;
                })
                .filter((n): n is number => n != null);
            // Medal usa Medal CH (que cambia según sección)
            const netsForPairMedal = (rps: typeof pairAR) =>
              rps
                .map((rp) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return null;
                  const { medalCh } = chForRpSection(rp, lbSection);
                  const strokes = strokesPerHole(medalCh, courseHcpMap)[h.number] ?? 0;
                  return sc - strokes;
                })
                .filter((n): n is number => n != null);
            // Stableford usa Stableford CH
            const stblForPair = (rps: typeof pairAR) =>
              rps
                .map((rp) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return 0;
                  const { stblCh } = chForRpSection(rp, lbSection);
                  const strokes = strokesPerHole(stblCh, courseHcpMap)[h.number] ?? 0;
                  return stablefordPoints(h.par, sc, strokes);
                })
                .reduce((s, v) => s + v, 0);

            const netsAMatch = netsForPairMatch(pairAR);
            const netsBMatch = netsForPairMatch(pairBR);
            const netsAMedal = netsForPairMedal(pairAR);
            const netsBMedal = netsForPairMedal(pairBR);

            stblA += stblForPair(pairAR);
            stblB += stblForPair(pairBR);

            if (netsAMedal.length === 2 && netsBMedal.length === 2) {
              played++;
              medalA += netsAMedal[0] + netsAMedal[1];
              medalB += netsBMedal[0] + netsBMedal[1];
            }
            if (netsAMatch.length === 2 && netsBMatch.length === 2) {
              const minA = Math.min(...netsAMatch);
              const maxA = Math.max(...netsAMatch);
              const minB = Math.min(...netsBMatch);
              const maxB = Math.max(...netsBMatch);
              if (minA < minB) matchA += 2;
              else if (minB < minA) matchB += 2;
              if (maxA < maxB) matchA += 1;
              else if (maxB < maxA) matchB += 1;
            }
          }

          pairsStandings = [
            {
              label: "Pareja A",
              playerNames: pairAR.map((rp) => rp.player.name),
              matchPoints: matchA,
              medalSum: medalA,
              stbl: stblA,
              holesPlayed: played,
            },
            {
              label: "Pareja B",
              playerNames: pairBR.map((rp) => rp.player.name),
              matchPoints: matchB,
              medalSum: medalB,
              stbl: stblB,
              holesPlayed: played,
            },
          ];
        }
      }
    } catch {}
  }

  // Match Play 3 jugadores: 6 pts en juego por hoyo (4,2,0 / 3,3,0 / 4,1,1 / 0,0,0).
  // Usa HCP Stableford para stroke allocation. Por sección.
  const match3pPoints: Record<string, number> = {};
  // Detalle hoyo a hoyo para tabla de progresión: { holeNumber, perPlayer: { rpId: pts }, nets: { rpId: net } }
  const match3pByHole: {
    holeNumber: number;
    perPlayer: Record<string, number>;
    nets: Record<string, number | null>;
  }[] = [];
  let match3pActive = false;
  if (
    round.players.length === 3 &&
    !pairsStandings &&
    (round.mode !== "TWO_P" && round.mode !== "FOUR_P")
  ) {
    match3pActive = true;
    for (const rp of round.players) match3pPoints[rp.id] = 0;
    const chs = round.players.map((rp) => chForRpSection(rp, lbSection).stblCh);
    for (const h of holesForSection(lbSection)) {
      const perPlayer: Record<string, number> = {};
      const netsByPlayer: Record<string, number | null> = {};
      for (const rp of round.players) {
        perPlayer[rp.id] = 0;
        netsByPlayer[rp.id] = null;
      }
      const nets = round.players
        .map((rp, i) => {
          const score = data[rp.id]?.[h.number]?.score;
          if (score == null || score === 0) return null;
          const strokes = strokesPerHole(chs[i], courseHcpMap)[h.number] ?? 0;
          const net = score - strokes;
          netsByPlayer[rp.id] = net;
          return { id: rp.id, net };
        })
        .filter((x): x is { id: string; net: number } => x != null);
      if (nets.length === 3) {
        const sorted = [...nets].sort((a, b) => a.net - b.net);
        const allEqual = sorted.every((n) => n.net === sorted[0].net);
        if (!allEqual) {
          const minNet = sorted[0].net;
          const maxNet = sorted[2].net;
          const tiedAtMin = sorted.filter((n) => n.net === minNet).length;
          if (tiedAtMin === 2) {
            for (const n of nets) if (n.net === minNet) perPlayer[n.id] = 3;
          } else {
            const middleNet = sorted[1].net;
            const middleEqualsMax = middleNet === maxNet;
            for (const n of nets) {
              if (n.net === minNet) perPlayer[n.id] = 4;
              else if (middleEqualsMax) perPlayer[n.id] = 1;
              else if (n.net === middleNet) perPlayer[n.id] = 2;
            }
          }
        }
      }
      for (const rp of round.players) match3pPoints[rp.id] += perPlayer[rp.id];
      match3pByHole.push({ holeNumber: h.number, perPlayer, nets: netsByPlayer });
    }
  }

  // Match Play 1v1 (solo si TWO_P) — usa HCP Stableford
  let matchScore: { a: number; b: number } | null = null;
  if (round.mode === "TWO_P" && round.players.length === 2) {
    const [a, b] = round.players;
    const { stblCh: chA } = chForRpSection(a, lbSection);
    const { stblCh: chB } = chForRpSection(b, lbSection);
    let aWins = 0, bWins = 0;
    for (const h of holesForSection(lbSection)) {
      const scoreA = data[a.id]?.[h.number]?.score;
      const scoreB = data[b.id]?.[h.number]?.score;
      if (scoreA != null && scoreB != null && scoreA > 0 && scoreB > 0) {
        const strokesA = strokesPerHole(chA, courseHcpMap)[h.number] ?? 0;
        const strokesB = strokesPerHole(chB, courseHcpMap)[h.number] ?? 0;
        const netA = scoreA - strokesA;
        const netB = scoreB - strokesB;
        if (netA < netB) aWins++;
        else if (netA > netB) bWins++;
      }
    }
    matchScore = { a: aWins, b: bWins };
  }

  const nav = (
    <div className="flex items-center gap-2 sticky top-0 z-30 bg-[var(--sand)] py-2 -mx-4 px-4">
      <button
        onClick={() => setCurrentHole((h) => Math.max(minHole, h - 1))}
        className="gf-btn gf-btn-secondary !px-3"
        disabled={currentHole === minHole}
      >
        ‹
      </button>
      <select
        className="gf-input flex-1 text-center font-semibold"
        value={currentHole}
        onChange={(e) => setCurrentHole(parseInt(e.target.value))}
      >
        {courseHoles.map((h) => (
          <option key={h.number} value={h.number}>
            Hoyo {h.number} · Par {h.par}
          </option>
        ))}
      </select>
      <button
        onClick={() => setCurrentHole((h) => Math.min(maxHole, h + 1))}
        className="gf-btn !px-3"
        disabled={currentHole === maxHole}
      >
        ›
      </button>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      <header className="flex justify-between items-baseline">
        <div>
          <h1 className="gf-display text-2xl text-[var(--fairway)]">
            {round.course.name}
          </h1>
          <p className="text-xs text-[var(--muted)] gf-mono">
            {new Date(round.date).toLocaleDateString("es-AR")} ·{" "}
            SZ {round.enterSzYds}y · Down {round.downInSzStrokes} · 1PC {round.onePuttCircleFt}ft
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Link
            href={`/rondas/${round.id}/resumen`}
            className="gf-pill"
          >
            Resumen ›
          </Link>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="text-[11px] text-[var(--muted)] underline"
          >
            ⚙️ Editar setup
          </button>
          <Link
            href={`/rondas/${round.id}/briefing`}
            className="text-[11px] text-[var(--muted)] underline"
          >
            🧠 Briefing
          </Link>
        </div>
      </header>

      {setupOpen && (
        <EditarSetupModal round={round} onClose={() => setSetupOpen(false)} />
      )}

      {/* HCP por modalidad — desplegable, primero */}
      {round.players.some((rp) => rp.modalityHcps) && (
        <details className="rounded p-2" style={{ background: "var(--white)" }}>
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-[var(--muted)]">
            🎯 HCP por modalidad
          </summary>
          <table className="w-full text-[10px] mt-2">
            <thead>
              <tr>
                <th className="text-left p-0.5 text-[var(--muted)]">Mod.</th>
                {round.players.map((rp) => (
                  <th key={rp.id} className="p-0.5 text-center text-[var(--muted)]">
                    {rp.player.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["MEDAL", "MEDAL_IDA", "MEDAL_VUELTA", "STABLEFORD", "STABLEFORD_IDA", "STABLEFORD_VUELTA"] as const).map(
                (mod) => (
                  <tr key={mod} className="border-t border-[var(--green-pale)]">
                    <td className="p-0.5 gf-mono text-[var(--muted)]">
                      {mod === "MEDAL" ? "Medal Tot" : mod === "MEDAL_IDA" ? "Medal Ida" : mod === "MEDAL_VUELTA" ? "Medal Vta" : mod === "STABLEFORD" ? "Stbl Tot" : mod === "STABLEFORD_IDA" ? "Stbl Ida" : "Stbl Vta"}
                    </td>
                    {round.players.map((rp) => {
                      const chs = rp.modalityHcps as Record<string, number> | null;
                      const v = chs?.[mod];
                      return (
                        <td key={rp.id} className="p-0.5 text-center gf-mono">
                          {v != null ? v : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <div className="text-[9px] text-[var(--muted)] mt-1 text-center">
            * Medal CH usa stroke allocation hoyo a hoyo. Stableford usa Stableford CH.
          </div>
        </details>
      )}

      {/* Leaderboard live (no SOLO) */}
      {!isSolo && (
        <Card className="!p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Leaderboard
            </span>
            {pairsStandings ? (
              <span className="gf-mono text-sm">
                {pairMatchDisplay(pairsStandings)}
              </span>
            ) : matchScore ? (
              <span className="gf-mono text-sm">
                Match: {matchScore.a}–{matchScore.b}
              </span>
            ) : null}
          </div>

          {/* Tabs Ida / Vuelta / Total — si la ronda es de 9 hoyos solo mostramos
              la sección jugada (Total y la otra mitad no tienen sentido). */}
          {(() => {
            const sections: LBSection[] =
              round.holesPlayed === 9
                ? round.nineWhich === "VUELTA"
                  ? ["VUELTA"]
                  : ["IDA"]
                : ["IDA", "VUELTA", "TOTAL"];
            if (sections.length === 1) return null;
            return (
              <div className="flex gap-1 mb-2">
                {sections.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setLbSection(sec)}
                    className="flex-1 text-[10px] uppercase tracking-wider py-1 rounded"
                    style={{
                      background:
                        lbSection === sec ? "var(--fairway)" : "var(--green-pale)",
                      color: lbSection === sec ? "white" : "var(--fairway)",
                      fontWeight: lbSection === sec ? 700 : 500,
                    }}
                  >
                    {sec === "IDA"
                      ? "Ida (1-9)"
                      : sec === "VUELTA"
                        ? "Vuelta (10-18)"
                        : "Total"}
                  </button>
                ))}
              </div>
            );
          })()}

          {pairsStandings ? (
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Pareja</th>
                  {showMatch && <th className="text-right">Match</th>}
                  {showMedal && <th className="text-right">Medal</th>}
                  {showStbl && <th className="text-right">Stbl</th>}
                </tr>
              </thead>
              <tbody>
                {pairsStandings.map((p, i) => {
                  const other = pairsStandings![1 - i];
                  const diff = p.matchPoints - other.matchPoints;
                  return (
                    <tr key={p.label}>
                      <td>
                        <div className="font-semibold">{p.label}</div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {p.playerNames.join(" · ")}
                        </div>
                      </td>
                      {showMatch && (
                        <td className="text-right gf-mono">
                          {p.matchPoints}
                          {diff > 0 && (
                            <span className="text-[var(--green)] text-[10px] ml-1">
                              +{diff}
                            </span>
                          )}
                        </td>
                      )}
                      {showMedal && (
                        <td className="text-right gf-mono">{p.medalSum || "—"}</td>
                      )}
                      {showStbl && <td className="text-right gf-mono">{p.stbl}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th className="text-right">Bruto</th>
                  {showMedal && <th className="text-right">Neto</th>}
                  {showStbl && <th className="text-right">Stbl</th>}
                  {showMatch && match3pActive && <th className="text-right">Match</th>}
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr key={s.rp.id}>
                    <td>
                      {s.rp.player.name}{" "}
                      {s.rp.player.isMe && <Pill variant="accent">YO</Pill>}
                    </td>
                    <td className="text-right gf-mono">{s.bruto || "—"}</td>
                    {showMedal && (
                      <td className="text-right gf-mono">{s.neto || "—"}</td>
                    )}
                    {showStbl && (
                      <td className="text-right gf-mono">{s.stableford}</td>
                    )}
                    {showMatch && match3pActive && (
                      <td className="text-right gf-mono">
                        {match3pPoints[s.rp.id] ?? 0}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Progresión Match 3P hoyo a hoyo — para verificar el cálculo */}
      {showMatch && match3pActive && (
        <details className="rounded p-2" style={{ background: "var(--white)" }}>
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-[var(--muted)]">
            📊 Progresión match (hoyo a hoyo)
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[10px] gf-mono">
              <thead>
                <tr>
                  <th className="text-left p-0.5">H</th>
                  {round.players.map((rp) => (
                    <th key={rp.id} className="text-right p-0.5">
                      {rp.player.name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cum: Record<string, number> = {};
                  for (const rp of round.players) cum[rp.id] = 0;
                  return match3pByHole.map((row) => {
                    for (const rp of round.players) cum[rp.id] += row.perPlayer[rp.id];
                    return (
                      <tr key={row.holeNumber} className="border-t border-[var(--green-pale)]">
                        <td className="p-0.5 text-[var(--muted)]">{row.holeNumber}</td>
                        {round.players.map((rp) => {
                          const pts = row.perPlayer[rp.id];
                          const net = row.nets[rp.id];
                          const total = cum[rp.id];
                          return (
                            <td key={rp.id} className="text-right p-0.5">
                              <span className={pts > 0 ? "font-bold text-[var(--fairway)]" : "text-[var(--muted)]"}>
                                +{pts}
                              </span>
                              <span className="text-[var(--muted)]"> ({total})</span>
                              {net != null && (
                                <span className="text-[8px] text-[var(--muted)] ml-1">
                                  n{net}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Scorecard live (accordion) */}
      {(() => {
        // Calcular puntos por hoyo en parejas (BB + WB)
        type PairPts = { holeNumber: number; ptsA: number; ptsB: number };
        const pairsPointsByHole: PairPts[] = [];
        if (round.mode === "FOUR_P" && round.pairs) {
          try {
            const pairsJSON: string[][] = JSON.parse(round.pairs);
            const rpByPlayerId = new Map(round.players.map((rp) => [rp.player.id, rp]));
            const pairAR = pairsJSON[0]?.map((pid) => rpByPlayerId.get(pid)).filter((x): x is NonNullable<typeof x> => Boolean(x)) ?? [];
            const pairBR = pairsJSON[1]?.map((pid) => rpByPlayerId.get(pid)).filter((x): x is NonNullable<typeof x> => Boolean(x)) ?? [];
            if (pairAR.length === 2 && pairBR.length === 2) {
              for (const h of courseHoles) {
                const netFor = (rp: typeof pairAR[number]) => {
                  const sc = data[rp.id]?.[h.number]?.score;
                  if (sc == null || sc === 0) return null;
                  // Match usa HCP Stableford (regla planilla)
                  const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
                  const ch = mh?.STABLEFORD ?? rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
                  const strokes = strokesPerHole(ch, courseHcpMap)[h.number] ?? 0;
                  return sc - strokes;
                };
                const netsA = pairAR.map(netFor).filter((n): n is number => n != null);
                const netsB = pairBR.map(netFor).filter((n): n is number => n != null);
                let ptsA = 0;
                let ptsB = 0;
                if (netsA.length === 2 && netsB.length === 2) {
                  const minA = Math.min(...netsA), maxA = Math.max(...netsA);
                  const minB = Math.min(...netsB), maxB = Math.max(...netsB);
                  if (minA < minB) ptsA += 2; else if (minB < minA) ptsB += 2;
                  if (maxA < maxB) ptsA += 1; else if (maxB < maxA) ptsB += 1;
                }
                pairsPointsByHole.push({ holeNumber: h.number, ptsA, ptsB });
              }
            }
          } catch {}
        }

        return (
          <Card className="!p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setScorecardOpen(!scorecardOpen)}
              className="w-full flex justify-between items-center p-3 text-sm font-semibold text-[var(--fairway)]"
            >
              <span>📋 Scorecard live</span>
              <span>{scorecardOpen ? "▾" : "▸"}</span>
            </button>
            {scorecardOpen && (
              <div className="!p-1 overflow-x-auto border-t border-[var(--green-pale)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">H</th>
                      <th className="text-center p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Par</th>
                      {round.players.map((rp) => (
                        <th
                          key={rp.id}
                          className="p-1 text-center text-[9px] uppercase tracking-wider"
                          style={{ color: rp.player.isMe ? "var(--accent)" : "var(--muted)" }}
                        >
                          {rp.player.name.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Ida = hoyos 1-9 dentro del set jugado, Vuelta = 10-18
                      const idaHoles = courseHoles.filter((h) => h.number <= 9);
                      const vueltaHoles = courseHoles.filter((h) => h.number >= 10);

                      function totalRow(
                        label: string,
                        holes: typeof courseHoles,
                        showVsPar: boolean,
                      ) {
                        const totalPar = holes.reduce((s, h) => s + h.par, 0);
                        return (
                          <tr
                            key={`total-${label}`}
                            className="font-bold border-t-2 border-[var(--fairway)]"
                            style={{ background: "var(--green-pale)" }}
                          >
                            <td className="p-1 text-[10px] uppercase">{label}</td>
                            <td className="p-1 text-center gf-mono text-[10px] text-[var(--muted)]">
                              {totalPar}
                            </td>
                            {round.players.map((rp) => {
                              let total = 0;
                              let parPlayed = 0;
                              let played = 0;
                              for (const h of holes) {
                                const sc = data[rp.id]?.[h.number]?.score;
                                if (sc != null && sc > 0) {
                                  total += sc;
                                  parPlayed += h.par;
                                  played++;
                                }
                              }
                              const vsPar = total - parPlayed;
                              const vsLabel =
                                played === 0
                                  ? ""
                                  : vsPar === 0
                                  ? "E"
                                  : vsPar > 0
                                  ? `+${vsPar}`
                                  : `${vsPar}`;
                              const vsColor =
                                vsPar === 0
                                  ? "var(--muted)"
                                  : vsPar > 0
                                  ? vsPar <= 6
                                    ? "var(--accent)"
                                    : "var(--red)"
                                  : "var(--green)";
                              return (
                                <td key={rp.id} className="p-1 text-center gf-mono">
                                  <div>{total > 0 ? total : "—"}</div>
                                  {showVsPar && rp.player.isMe && played > 0 && (
                                    <div
                                      className="text-[9px] font-bold"
                                      style={{ color: vsColor }}
                                    >
                                      {vsLabel}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }

                      return (
                        <>
                          {/* Hoyos 1-9 */}
                          {idaHoles.map((h) => {
                            const isCurrent = h.number === currentHole;
                            return (
                              <tr
                                key={h.number}
                                className="border-b border-[var(--green-pale)] cursor-pointer"
                                onClick={() => setCurrentHole(h.number)}
                                style={{ background: isCurrent ? "var(--green-pale)" : undefined }}
                              >
                                <td className="p-1 gf-mono font-semibold">{h.number}</td>
                                <td className="p-1 gf-mono text-center text-[var(--muted)]">{h.par}</td>
                                {round.players.map((rp) => {
                                  const score = data[rp.id]?.[h.number]?.score;
                                  return (
                                    <td key={rp.id} className="p-1 text-center">
                                      <ScoreMark score={score} par={h.par} />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {/* Out (1-9) total — solo si hay hoyos 1-9 */}
                          {idaHoles.length > 0 && totalRow("Out", idaHoles, true)}

                          {/* Hoyos 10-18 */}
                          {vueltaHoles.map((h) => {
                            const isCurrent = h.number === currentHole;
                            return (
                              <tr
                                key={h.number}
                                className="border-b border-[var(--green-pale)] cursor-pointer"
                                onClick={() => setCurrentHole(h.number)}
                                style={{ background: isCurrent ? "var(--green-pale)" : undefined }}
                              >
                                <td className="p-1 gf-mono font-semibold">{h.number}</td>
                                <td className="p-1 gf-mono text-center text-[var(--muted)]">{h.par}</td>
                                {round.players.map((rp) => {
                                  const score = data[rp.id]?.[h.number]?.score;
                                  return (
                                    <td key={rp.id} className="p-1 text-center">
                                      <ScoreMark score={score} par={h.par} />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {/* In (10-18) total — solo si hay hoyos 10-18 */}
                          {vueltaHoles.length > 0 && totalRow("In", vueltaHoles, true)}

                          {/* Total general — solo si tiene ambas vueltas */}
                          {idaHoles.length > 0 &&
                            vueltaHoles.length > 0 &&
                            totalRow("Total", courseHoles, true)}
                        </>
                      );
                    })()}

                    {/* Puntos Match BB+WB por hoyo en parejas */}
                    {pairsPointsByHole.length > 0 && (
                      <>
                        <tr className="border-t-2 border-[var(--accent)]">
                          <td colSpan={2 + round.players.length} className="p-1 text-[9px] uppercase tracking-wider text-[var(--muted)] text-center">
                            Match BB + WB por hoyo
                          </td>
                        </tr>
                        <tr>
                          <td className="p-1 text-[10px] font-semibold">Pts A</td>
                          <td></td>
                          <td colSpan={round.players.length}>
                            <div className="grid grid-cols-9 gap-px text-[10px]">
                              {pairsPointsByHole.slice(0, 9).map((p) => (
                                <span key={p.holeNumber} className="text-center gf-mono"
                                  style={{
                                    background: p.ptsA > p.ptsB ? "var(--green-pale)" : p.ptsA < p.ptsB ? "#fde0dc" : undefined,
                                    color: p.ptsA > p.ptsB ? "var(--green)" : p.ptsA < p.ptsB ? "var(--red)" : undefined,
                                  }}
                                >
                                  {p.ptsA}
                                </span>
                              ))}
                            </div>
                            <div className="grid grid-cols-9 gap-px text-[10px] mt-px">
                              {pairsPointsByHole.slice(9, 18).map((p) => (
                                <span key={p.holeNumber} className="text-center gf-mono"
                                  style={{
                                    background: p.ptsA > p.ptsB ? "var(--green-pale)" : p.ptsA < p.ptsB ? "#fde0dc" : undefined,
                                    color: p.ptsA > p.ptsB ? "var(--green)" : p.ptsA < p.ptsB ? "var(--red)" : undefined,
                                  }}
                                >
                                  {p.ptsA}
                                </span>
                              ))}
                            </div>
                            <div className="text-right gf-mono text-[10px] font-bold mt-1">
                              Total A: {pairsPointsByHole.reduce((s, p) => s + p.ptsA, 0)}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-1 text-[10px] font-semibold">Pts B</td>
                          <td></td>
                          <td colSpan={round.players.length}>
                            <div className="grid grid-cols-9 gap-px text-[10px]">
                              {pairsPointsByHole.slice(0, 9).map((p) => (
                                <span key={p.holeNumber} className="text-center gf-mono"
                                  style={{
                                    background: p.ptsB > p.ptsA ? "var(--green-pale)" : p.ptsB < p.ptsA ? "#fde0dc" : undefined,
                                    color: p.ptsB > p.ptsA ? "var(--green)" : p.ptsB < p.ptsA ? "var(--red)" : undefined,
                                  }}
                                >
                                  {p.ptsB}
                                </span>
                              ))}
                            </div>
                            <div className="grid grid-cols-9 gap-px text-[10px] mt-px">
                              {pairsPointsByHole.slice(9, 18).map((p) => (
                                <span key={p.holeNumber} className="text-center gf-mono"
                                  style={{
                                    background: p.ptsB > p.ptsA ? "var(--green-pale)" : p.ptsB < p.ptsA ? "#fde0dc" : undefined,
                                    color: p.ptsB > p.ptsA ? "var(--green)" : p.ptsB < p.ptsA ? "var(--red)" : undefined,
                                  }}
                                >
                                  {p.ptsB}
                                </span>
                              ))}
                            </div>
                            <div className="text-right gf-mono text-[10px] font-bold mt-1">
                              Total B: {pairsPointsByHole.reduce((s, p) => s + p.ptsB, 0)}
                            </div>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })()}

      {nav}

      {/* Tracker del hoyo actual: para Santi (siempre full datos) + score para los demás */}
      {currentHoleInfo && (
        <>
          <div ref={holeHeaderRef} style={{ scrollMarginTop: 16 }}>
            <SectionHeader>
              Hoyo {currentHole} · Par {currentHoleInfo.par} · HCP {currentHoleInfo.hcpHoyo}
            </SectionHeader>
          </div>
          {/* Quién tiene golpe en este hoyo (usa HCP Stableford = Match Play stroke allocation) */}
          {(() => {
            const strokesAt = round.players.map((rp) => {
              const mh = (rp.modalityHcps as Record<string, number> | null) ?? null;
              const hcp = mh?.STABLEFORD ?? rp.courseHcp ?? Math.round(rp.hcpIndex ?? 0);
              const s = strokesPerHole(hcp, courseHcpMap)[currentHole] ?? 0;
              return { name: rp.player.name, isMe: rp.player.isMe, strokes: s };
            });
            const withStrokes = strokesAt.filter((x) => x.strokes !== 0);
            if (withStrokes.length === 0) {
              return (
                <Card className="!p-2 text-center">
                  <span className="text-[11px] text-[var(--muted)]">
                    Nadie tiene golpe en este hoyo
                  </span>
                </Card>
              );
            }
            return (
              <Card className="!p-2">
                <div className="flex flex-wrap gap-1.5 items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Golpes:
                  </span>
                  {withStrokes.map((x) => (
                    <span
                      key={x.name}
                      className="gf-pill gf-mono"
                      style={{
                        background: x.strokes > 0 ? "var(--accent-light)" : "#fde0dc",
                        color: x.strokes > 0 ? "var(--accent)" : "var(--red)",
                      }}
                    >
                      {x.name.split(" ")[0]} {x.strokes > 0 ? "+" : ""}{x.strokes}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* === BLOQUE PRINCIPAL: YO === */}
          {(() => {
            const rp = meRP;
            const cells = data[rp.id]?.[currentHole] ?? {};
            const hasSmData = hasSmDataInHole(rp.id, currentHole);
            const showSm = (smExpanded[rp.id] ?? false) || hasSmData;

            return (
              <Card key={rp.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {rp.player.name}
                    {rp.player.isMe && (
                      <span className="ml-2"><Pill variant="accent">YO</Pill></span>
                    )}
                  </span>
                  {cells.score != null && (
                    <span className="gf-display text-2xl text-[var(--fairway)]">
                      {cells.score}
                    </span>
                  )}
                </div>

                {/* 1. Decisiones PRE-shot: Gear + DECADE (van antes del swing) */}
                <GearSelector
                  currentHole={currentHole}
                  roundGoal={
                    findGoalByConfig(round.enterSzYds, round.downInSzStrokes)?.label ??
                    null
                  }
                  cells={data[rp.id] ?? {}}
                  onSetGoal={(goal) => setTargetGoal(rp.id, currentHole, goal)}
                />

                <DecadeInput
                  pinColor={cells.pinColor ?? null}
                  dangerSide={cells.dangerSide ?? null}
                  aimedAtCenter={cells.aimedAtCenter ?? null}
                  recoveryMode={cells.recoveryMode ?? null}
                  onSet={(field, value) =>
                    setDecade(rp.id, currentHole, field, value)
                  }
                />

                {/* 2. Score total (post-swing) + indicador vsPar */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumField
                      label="Score total"
                      value={cells.score ?? null}
                      onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                      big
                    />
                  </div>
                  {cells.score != null && cells.score > 0 && currentHoleInfo && (
                    <VsParPill score={cells.score} par={currentHoleInfo.par} />
                  )}
                </div>

                {/* 3. Stats SM a completar (collapsable) */}
                {showSm ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--green-pale)]">
                      <NumField
                        label="Strokes to Enter SZ"
                        value={cells.strokesToEnterSz ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "strokesToEnterSz", v)}
                      />
                      <NumField
                        label="Distancia REG (yds)"
                        value={cells.distanceInRegYds ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "distanceInRegYds", v)}
                        showGir
                      />
                      <NumField
                        label="Strokes inside SZ"
                        value={cells.strokesInsideSz ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "strokesInsideSz", v)}
                      />
                      <NumField
                        label="Putts"
                        value={cells.putts ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "putts", v)}
                      />
                      <NumField
                        label="1st putt (ft)"
                        value={cells.firstPuttDistanceFt ?? null}
                        onChange={(v) =>
                          setCell(rp.id, currentHole, "firstPuttDistanceFt", v)
                        }
                      />
                      <NumField
                        label="Putt embocado (ft)"
                        value={cells.puttMadeDistanceFt ?? null}
                        onChange={(v) =>
                          setCell(rp.id, currentHole, "puttMadeDistanceFt", v)
                        }
                      />
                      <NumField
                        label={`Putts dentro 1PC (${round.onePuttCircleFt}ft)`}
                        value={cells.puttsInside1PuttCircle ?? null}
                        onChange={(v) =>
                          setCell(rp.id, currentHole, "puttsInside1PuttCircle", v)
                        }
                      />
                      <NumField
                        label="Penalidades"
                        value={cells.penaltyStrokes ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "penaltyStrokes", v)}
                        isLast
                      />
                    </div>
                    <FlagRow
                      cells={cells}
                      config={{
                        enterSzYds: round.enterSzYds,
                        downInSzStrokes: round.downInSzStrokes,
                        onePuttCircleFt: round.onePuttCircleFt,
                        twoPuttCircleYds: round.twoPuttCircleYds,
                      }}
                      par={currentHoleInfo.par}
                      holeNumber={currentHole}
                    />
                    {!hasSmData && (
                      <button
                        type="button"
                        onClick={() => toggleSm(rp.id)}
                        className="text-[10px] text-[var(--muted)] underline"
                      >
                        Ocultar stats SM
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSm(rp.id)}
                    className="text-xs text-[var(--fairway)] underline"
                  >
                    + Agregar stats Scoring Method
                  </button>
                )}

                {/* 4. Keys rotas (post-swing) */}
                <KeysBrokenInput
                  keysBroken={cells.keysBroken ?? []}
                  onToggle={(keyId) => toggleKey(rp.id, currentHole, keyId)}
                />
              </Card>
            );
          })()}

          {/* === SCORES DEL RESTO DE LOS JUGADORES === */}
          {round.players
            .filter((rp) => rp.id !== meRP.id)
            .map((rp) => {
              const cells = data[rp.id]?.[currentHole] ?? {};
              const hasSmData = hasSmDataInHole(rp.id, currentHole);
              const showSm = (smExpanded[rp.id] ?? false) || hasSmData;

              return (
                <Card key={rp.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{rp.player.name}</span>
                    {cells.score != null && (
                      <span className="gf-display text-2xl text-[var(--fairway)]">
                        {cells.score}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <NumField
                        label="Score total"
                        value={cells.score ?? null}
                        onChange={(v) => setCell(rp.id, currentHole, "score", v)}
                        big
                        isLast={!showSm}
                      />
                    </div>
                    {cells.score != null && cells.score > 0 && currentHoleInfo && (
                      <VsParPill score={cells.score} par={currentHoleInfo.par} />
                    )}
                  </div>

                </Card>
              );
            })}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveAll} disabled={busy} className="gf-btn">
              {busy ? "Guardando..." : "💾 Guardar"}
            </button>
            <button
              onClick={() => {
                saveAll();
                if (currentHole < maxHole) setCurrentHole(currentHole + 1);
              }}
              className="gf-btn gf-btn-secondary"
            >
              Siguiente hoyo →
            </button>
          </div>

          <button
            onClick={async () => {
              await saveAll();
              await fetch(`/api/rondas/${round.id}/close`, { method: "POST" });
              router.push(`/rondas/${round.id}/resumen`);
            }}
            className="gf-btn w-full mt-2"
            style={{ background: "var(--accent)", color: "var(--ink)" }}
          >
            🏁 Finalizar ronda y ver resumen
          </button>
        </>
      )}

      {/* Shot-capture por voz ARCHIVADO 26/07 (pedido de Santi: cero teléfono en cancha).
          La ruta /rondas/[id]/shot-capture y toda la infra quedan vivas para retomar. */}

      {/* FAB: ir al GPS / mapa del hoyo actual */}
      <Link
        href={`/labs/maps/${round.courseId}/play?round=${round.id}`}
        className="fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
        style={{
          width: 64,
          height: 64,
          background: "var(--fairway)",
          color: "white",
          fontSize: 28,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
        aria-label="Abrir mapa GPS del hoyo"
      >
        📍
      </Link>
    </div>
  );
}

function pairMatchDisplay(
  pairs: { label: string; matchPoints: number; holesPlayed: number }[],
): string {
  const [a, b] = pairs;
  const diff = a.matchPoints - b.matchPoints;
  if (diff === 0) return "All Square";
  const winner = diff > 0 ? a.label : b.label;
  return `${winner} ${Math.abs(diff)} arriba`;
}

function NumField({
  label,
  value,
  onChange,
  big = false,
  showGir = false,
  isLast = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: string) => void;
  big?: boolean;
  showGir?: boolean;
  isLast?: boolean;
}) {
  function focusNext(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input.gf-numfield"),
    );
    const cur = inputs.indexOf(e.currentTarget);
    if (cur === -1) return;
    const next = inputs[cur + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      e.currentTarget.blur();
    }
  }

  const isGir = showGir && value === 0;

  return (
    <div className={big ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
        {label}
        {isGir && (
          <span className="gf-pill gf-pill-accent !py-0 !px-1.5 text-[9px]">
            GIR ✅
          </span>
        )}
      </label>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint={isLast ? "done" : "next"}
        className={`gf-input gf-numfield mt-0.5 ${big ? "text-2xl text-center font-bold" : ""}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={focusNext}
      />
    </div>
  );
}

function FlagRow({
  cells,
  config,
  par,
  holeNumber,
}: {
  cells: Partial<Record<FieldKey, number | null>>;
  config: { enterSzYds: number; downInSzStrokes: number; onePuttCircleFt: number; twoPuttCircleYds: number };
  par: number;
  holeNumber: number;
}) {
  const flags = computeHoleFlags(
    {
      holeNumber,
      par,
      strokesToEnterSz: cells.strokesToEnterSz ?? null,
      distanceInRegYds: cells.distanceInRegYds ?? null,
      strokesInsideSz: cells.strokesInsideSz ?? null,
      putts: cells.putts ?? null,
      firstPuttDistanceFt: cells.firstPuttDistanceFt ?? null,
      puttMadeDistanceFt: cells.puttMadeDistanceFt ?? null,
      puttsInside1PuttCircle: cells.puttsInside1PuttCircle ?? null,
      score: cells.score ?? null,
    },
    config,
  );

  function f(label: string, v: boolean | null) {
    if (v === null) return <span className="text-[var(--muted)] text-[10px]">{label}: —</span>;
    return (
      <span className="text-[10px]">
        {label}: <span className={v ? "gf-flag-ok" : "gf-flag-bad"}>{v ? "✅" : "❌"}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-[var(--green-pale)]">
      {f("Enter SZ", flags.enterSz)}
      {f("Down in SZ", flags.downInSz)}
      {f("3 putts", flags.threePutts)}
      {f("1PC", flags.missedIn1PuttCircle)}
    </div>
  );
}

// Indicador vs par junto al score input
function VsParPill({ score, par }: { score: number; par: number }) {
  const vs = score - par;
  let label = "PAR";
  let color = "var(--muted)";
  let bg = "var(--green-pale)";
  if (vs <= -2) {
    label = "EAGLE";
    color = "white";
    bg = "var(--green)";
  } else if (vs === -1) {
    label = "BIRDIE";
    color = "white";
    bg = "var(--green)";
  } else if (vs === 0) {
    label = "PAR";
    color = "var(--fairway)";
    bg = "var(--green-pale)";
  } else if (vs === 1) {
    label = "+1";
    color = "white";
    bg = "var(--accent)";
  } else if (vs === 2) {
    label = "+2";
    color = "white";
    bg = "var(--red)";
  } else {
    label = `+${vs}`;
    color = "white";
    bg = "var(--red)";
  }
  return (
    <span
      className="gf-pill gf-mono text-[11px] mb-1 shrink-0"
      style={{ background: bg, color, fontWeight: 700, padding: "4px 10px" }}
    >
      {label}
    </span>
  );
}

// Goal selector por hoyo con 2 ejes separados (Entry SZ + Down in SZ).
// Reemplaza el sistema viejo de "Gears combinados".
//
// Recomendación dinámica:
//  - Si los 2 hoyos previos fallaron AMBOS ejes (entry + down) → "Bajá ambos"
//  - Si solo falló entry → "Relajá entry" (de 25→50, 50→100)
//  - Si solo falló down → "Relajá down" (de 1→2, 2→3)
//  - Si los 2 hoyos previos cumplieron con goal bajado → "Volvé a subir"
function GearSelector({
  currentHole,
  roundGoal,
  cells,
  onSetGoal,
}: {
  currentHole: number;
  roundGoal: string | null;
  cells: Record<number, {
    targetGoal?: string | null;
    distanceInRegYds?: number | null;
    strokesInsideSz?: number | null;
  }>;
  onSetGoal: (goal: string | null) => void;
}) {
  const currentEntry = cells[currentHole] ?? {};
  // Goal "efectivo" del hoyo: el guardado, o el de la ronda si no hay
  const effectiveGoal = currentEntry.targetGoal ?? roundGoal;
  const goalObj = effectiveGoal ? findGoalByLabel(effectiveGoal) : null;

  // Mirar los 2 hoyos previos consecutivos
  const prevHoles = [currentHole - 1, currentHole - 2]
    .filter((n) => n >= 1)
    .map((n) => ({ holeNumber: n, ...cells[n] }))
    .filter((h) => h.distanceInRegYds != null && h.strokesInsideSz != null);

  // Diagnóstico granular: qué eje falla en cada uno de los 2 últimos hoyos
  type Reco = { kind: "RELAX_ENTRY" | "RELAX_DOWN" | "RELAX_BOTH" | "TIGHTEN"; to: string };
  let recommendation: Reco | null = null;
  if (prevHoles.length >= 2 && goalObj) {
    const diags = prevHoles.slice(0, 2).map((h) =>
      holeDiagnostic(goalObj, {
        distanceInRegYds: h.distanceInRegYds ?? null,
        strokesInsideSz: h.strokesInsideSz ?? null,
      }),
    );
    const allOK = diags.every((d) => d === "OK");
    const allFailedSomething = diags.every((d) => d != null && d !== "OK");

    if (allFailedSomething) {
      // Detectar patrón: si los 2 fallaron solo entry → relax entry. Solo down → relax down. Mezcla → both.
      const failedEntry = diags.filter((d) => d === "ENTRY_FAIL" || d === "BOTH_FAIL").length;
      const failedDown = diags.filter((d) => d === "DOWN_FAIL" || d === "BOTH_FAIL").length;
      const bothFail = diags.filter((d) => d === "BOTH_FAIL").length;

      if (bothFail >= 1 || (failedEntry >= 1 && failedDown >= 1)) {
        // Mezcla o ambos fallaron en algún hoyo → relax ambos (entry primero)
        const relaxed = relaxEntry(goalObj) ?? relaxDown(goalObj);
        if (relaxed) recommendation = { kind: "RELAX_BOTH", to: relaxed.label };
      } else if (failedEntry === 2) {
        const next = relaxEntry(goalObj);
        if (next) recommendation = { kind: "RELAX_ENTRY", to: next.label };
      } else if (failedDown === 2) {
        const next = relaxDown(goalObj);
        if (next) recommendation = { kind: "RELAX_DOWN", to: next.label };
      }
    } else if (allOK && roundGoal && effectiveGoal !== roundGoal) {
      // Está jugando bajo el roundGoal y pegó 2 seguidas → volver al original
      recommendation = { kind: "TIGHTEN", to: roundGoal };
    }
  }

  const isOverride = currentEntry.targetGoal != null && currentEntry.targetGoal !== roundGoal;
  const entryYds = goalObj?.enterSzYds ?? 50;
  const downStrokes = goalObj?.downInSzStrokes ?? 3;

  function setAxis(newEntry: number, newDown: number) {
    const newLabel = `${newEntry === 0 ? "GIR" : newEntry}/${newDown}`;
    onSetGoal(newLabel === roundGoal ? null : newLabel);
  }

  return (
    <div className="pt-2 border-t border-[var(--green-pale)] mt-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
        🎯 Goal de este hoyo
        {effectiveGoal && (
          <span className="ml-2 gf-mono text-[var(--fairway)] font-bold">{effectiveGoal}</span>
        )}
      </div>

      {/* Eje 1: Entry SZ */}
      <div className="text-[9px] text-[var(--muted)] mt-1.5 mb-0.5 uppercase tracking-wider">
        ① Entry
      </div>
      <div className="flex flex-wrap gap-1">
        {ENTRY_OPTIONS.map((opt) => {
          const active = entryYds === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAxis(opt.value, downStrokes)}
              className="text-[10px] px-2 py-1 rounded gf-mono flex-1 min-w-[40px]"
              style={{
                background: active ? "var(--fairway)" : "var(--green-pale)",
                color: active ? "white" : "var(--fairway)",
                fontWeight: active ? 700 : 500,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Eje 2: Down in SZ */}
      <div className="text-[9px] text-[var(--muted)] mt-2 mb-0.5 uppercase tracking-wider">
        ② Down in
      </div>
      <div className="flex flex-wrap gap-1">
        {DOWN_OPTIONS.map((d) => {
          const active = downStrokes === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setAxis(entryYds, d)}
              className="text-[10px] px-2 py-1 rounded gf-mono flex-1 min-w-[60px]"
              style={{
                background: active ? "var(--fairway)" : "var(--green-pale)",
                color: active ? "white" : "var(--fairway)",
                fontWeight: active ? 700 : 500,
              }}
            >
              {d} {d === 1 ? "golpe" : "golpes"}
            </button>
          );
        })}
      </div>

      {/* Volver al goal de la ronda */}
      {isOverride && (
        <button
          type="button"
          onClick={() => onSetGoal(null)}
          className="mt-2 text-[10px] text-[var(--muted)] underline"
          title="Volver al goal de la ronda"
        >
          ↺ Volver al goal de la ronda ({roundGoal})
        </button>
      )}

      {/* Recomendación dinámica */}
      {recommendation && (
        <div
          className="mt-2 p-2 rounded text-[11px]"
          style={{
            background:
              recommendation.kind === "TIGHTEN" ? "var(--green)" : "var(--accent)",
            color: "white",
          }}
        >
          💡{" "}
          {recommendation.kind === "TIGHTEN" ? (
            <>
              Volvé al goal original <strong>{recommendation.to}</strong> · 2 hoyos seguidos cumplidos
            </>
          ) : recommendation.kind === "RELAX_ENTRY" ? (
            <>
              Bajá el <strong>entry</strong> a <strong>{recommendation.to}</strong> · 2 hoyos sin llegar a la SZ
            </>
          ) : recommendation.kind === "RELAX_DOWN" ? (
            <>
              Relajá el <strong>down</strong> a <strong>{recommendation.to}</strong> · 2 hoyos sin bajar en los golpes
            </>
          ) : (
            <>
              Bajá un cambio a <strong>{recommendation.to}</strong> · 2 hoyos sin cumplir
            </>
          )}
          <button
            type="button"
            onClick={() => onSetGoal(recommendation!.to)}
            className="ml-2 underline font-semibold"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

// DECADE — Pre-shot decisions por hoyo (semáforo pin, hazard side, aim, recovery)
function DecadeInput({
  pinColor,
  dangerSide,
  aimedAtCenter,
  recoveryMode,
  onSet,
}: {
  pinColor: "GREEN" | "YELLOW" | "RED" | null;
  dangerSide: "L" | "R" | "NONE" | null;
  aimedAtCenter: boolean | null;
  recoveryMode: boolean | null;
  onSet: (
    field: "pinColor" | "dangerSide" | "aimedAtCenter" | "recoveryMode",
    value: string | boolean | null,
  ) => void;
}) {
  const pinOpts: { v: "GREEN" | "YELLOW" | "RED"; emoji: string; label: string }[] = [
    { v: "GREEN", emoji: "🟢", label: "Centro" },
    { v: "YELLOW", emoji: "🟡", label: "Borde" },
    { v: "RED", emoji: "🔴", label: "Trampa" },
  ];
  const sideOpts: { v: "L" | "R" | "NONE"; label: string }[] = [
    { v: "L", label: "Izq" },
    { v: "R", label: "Der" },
    { v: "NONE", label: "Sin" },
  ];

  return (
    <div className="pt-2 border-t border-[var(--green-pale)] mt-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        🧠 DECADE · decisiones de este hoyo
      </div>

      {/* 1. Danger Zone (desde el tee — pre-drive) */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] text-[var(--muted)] gf-mono w-20"
          title="Lado peligroso del hoyo desde el tee"
        >
          Danger Zone
        </span>
        {sideOpts.map((o) => {
          const active = dangerSide === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onSet("dangerSide", active ? null : o.v)}
              className="text-[10px] px-2 py-1 rounded gf-mono"
              style={{
                background: active ? "var(--accent)" : "var(--green-pale)",
                color: active ? "white" : "var(--fairway)",
                fontWeight: active ? 700 : 500,
              }}
              title={`Lado peligroso del hoyo: ${o.label}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* 2. Pin (al llegar al green — pre-approach) */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--muted)] gf-mono w-20">Pin</span>
        {pinOpts.map((o) => {
          const active = pinColor === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onSet("pinColor", active ? null : o.v)}
              className="text-[10px] px-2 py-1 rounded gf-mono"
              style={{
                background: active ? "var(--fairway)" : "var(--green-pale)",
                color: active ? "white" : "var(--fairway)",
                fontWeight: active ? 700 : 500,
              }}
              title={`Bandera ${o.label}`}
            >
              {o.emoji} {o.label}
            </button>
          );
        })}
      </div>

      {/* 3. Apunté al centro + 4. Recovery (post-shot) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSet("aimedAtCenter", aimedAtCenter === true ? null : true)}
          className="text-[10px] px-2 py-1 rounded gf-mono"
          style={{
            background: aimedAtCenter === true ? "var(--green)" : "var(--green-pale)",
            color: aimedAtCenter === true ? "white" : "var(--fairway)",
            fontWeight: aimedAtCenter === true ? 700 : 500,
          }}
          title="¿Apuntaste al centro del green (no a la bandera)?"
        >
          🎯 Apunté al centro
        </button>
        <button
          type="button"
          onClick={() => onSet("recoveryMode", recoveryMode === true ? null : true)}
          className="text-[10px] px-2 py-1 rounded gf-mono"
          style={{
            background: recoveryMode === true ? "var(--accent)" : "var(--green-pale)",
            color: recoveryMode === true ? "white" : "var(--fairway)",
            fontWeight: recoveryMode === true ? 700 : 500,
          }}
          title="¿Estuviste en problemas y jugaste solo para volver al juego?"
        >
          🛟 Recovery
        </button>
      </div>
    </div>
  );
}

function KeysBrokenInput({
  keysBroken,
  onToggle,
}: {
  keysBroken: number[];
  onToggle: (keyId: number) => void;
}) {
  return (
    <div className="pt-2 border-t border-[var(--green-pale)] mt-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
        🎯 Keys rotas en este hoyo
      </div>
      <div className="flex flex-wrap gap-1">
        {SM_KEYS.map((k) => {
          const active = keysBroken.includes(k.id);
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => onToggle(k.id)}
              className="text-[10px] px-2 py-1 rounded gf-mono"
              style={{
                background: active ? "var(--accent)" : "var(--green-pale)",
                color: active ? "white" : "var(--fairway)",
                fontWeight: active ? 700 : 500,
              }}
              title={k.solution}
            >
              {k.id}. {k.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
