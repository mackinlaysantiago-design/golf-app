"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill } from "@/components/ui/Card";

type Player = {
  id: string;
  name: string;
  hcpIndex: number | null;
  isMe: boolean;
  lucilaMatricula?: string | null;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function PlayersClient({ initialPlayers }: { initialPlayers: Player[] }) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [hcp, setHcp] = useState("");
  const [isMe, setIsMe] = useState(false);
  const [busy, setBusy] = useState(false);

  const [mergeFrom, setMergeFrom] = useState<{ player: Player; rounds: number } | null>(null);
  const [mergeInto, setMergeInto] = useState("");

  const me = players.find((p) => p.isMe) ?? null;
  const others = players.filter((p) => !p.isMe);

  const filteredOthers = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return showAll ? others : [];
    return others.filter((p) => normalize(p.name).includes(q));
  }, [others, query, showAll]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/jugadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        hcpIndex: hcp ? parseFloat(hcp) : null,
        isMe,
      }),
    });
    if (res.ok) {
      const p = await res.json();
      setPlayers((prev) => {
        const next = isMe ? prev.map((x) => ({ ...x, isMe: false })) : prev;
        return [...next, p].sort((a, b) =>
          a.isMe === b.isMe ? a.name.localeCompare(b.name) : a.isMe ? -1 : 1,
        );
      });
      setName("");
      setHcp("");
      setIsMe(false);
      setShowAddForm(false);
      router.refresh();
    }
    setBusy(false);
  }

  async function remove(p: Player) {
    if (!confirm(`Eliminar a ${p.name}?`)) return;
    const res = await fetch(`/api/jugadores/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      setPlayers((prev) => prev.filter((x) => x.id !== p.id));
      router.refresh();
      return;
    }
    if (res.status === 409) {
      const data = await res.json();
      // Tiene rondas — abrir modal de fusionar/forzar
      setMergeFrom({ player: p, rounds: data.roundsCount ?? 0 });
      setMergeInto("");
      return;
    }
    alert("Error eliminando jugador");
  }

  async function doMerge() {
    if (!mergeFrom || !mergeInto) return;
    setBusy(true);
    const res = await fetch(`/api/jugadores/${mergeFrom.player.id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: mergeInto }),
    });
    setBusy(false);
    if (!res.ok) {
      alert("Error fusionando");
      return;
    }
    setPlayers((prev) => prev.filter((x) => x.id !== mergeFrom.player.id));
    setMergeFrom(null);
    setMergeInto("");
    router.refresh();
  }

  async function forceDelete() {
    if (!mergeFrom) return;
    if (
      !confirm(
        `Esto borra a ${mergeFrom.player.name} Y sus participaciones en ${mergeFrom.rounds} rondas. ¿Seguro?`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/jugadores/${mergeFrom.player.id}?force=true`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      alert("Error eliminando");
      return;
    }
    setPlayers((prev) => prev.filter((x) => x.id !== mergeFrom.player.id));
    setMergeFrom(null);
    router.refresh();
  }

  async function setAsMe(id: string) {
    const res = await fetch(`/api/jugadores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMe: true }),
    });
    if (res.ok) {
      setPlayers((prev) => prev.map((p) => ({ ...p, isMe: p.id === id })));
      router.refresh();
    }
  }

  const [editingHcpId, setEditingHcpId] = useState<string | null>(null);
  const [editingHcpValue, setEditingHcpValue] = useState("");

  function startEditHcp(p: Player) {
    setEditingHcpId(p.id);
    setEditingHcpValue(p.hcpIndex != null ? String(p.hcpIndex) : "");
  }

  async function saveHcp(id: string) {
    const idx = editingHcpValue.trim() === "" ? null : parseFloat(editingHcpValue.replace(",", "."));
    if (editingHcpValue.trim() !== "" && isNaN(idx as number)) {
      alert("HCP inválido");
      return;
    }
    const res = await fetch(`/api/jugadores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hcpIndex: idx }),
    });
    if (res.ok) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, hcpIndex: idx } : p)),
      );
      setEditingHcpId(null);
      router.refresh();
    } else {
      alert("Error guardando");
    }
  }

  function renderPlayer(p: Player) {
    const isFromLucila = !!p.lucilaMatricula;
    const isEditing = editingHcpId === p.id;
    return (
      <Card key={p.id} className="!p-3 flex justify-between items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {p.name}
            {p.isMe && <Pill variant="accent">YO</Pill>}
            {isFromLucila && (
              <span
                className="gf-pill text-[9px]"
                style={{ background: "var(--green-pale)", color: "var(--fairway)" }}
                title="Sincronizado desde La Lucila — el HCP se actualiza solo"
              >
                LUCILA
              </span>
            )}
          </div>
          {!isEditing && p.hcpIndex != null && (
            <div className="text-xs text-[var(--muted)] gf-mono">
              HCP {p.hcpIndex.toFixed(1)}
            </div>
          )}
          {!isEditing && p.hcpIndex == null && !isFromLucila && (
            <div className="text-xs text-[var(--muted)]">sin HCP</div>
          )}
          {isEditing && (
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                autoFocus
                className="gf-input !p-1 !text-xs !w-20"
                placeholder="ej 8.9"
                value={editingHcpValue}
                onChange={(e) => setEditingHcpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveHcp(p.id);
                  if (e.key === "Escape") setEditingHcpId(null);
                }}
              />
              <button
                onClick={() => saveHcp(p.id)}
                className="text-[var(--fairway)] text-xs px-1"
              >
                ✓
              </button>
              <button
                onClick={() => setEditingHcpId(null)}
                className="text-[var(--muted)] text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 text-xs items-center shrink-0">
          {!isEditing && !isFromLucila && (
            <button
              onClick={() => startEditHcp(p)}
              className="text-[var(--fairway)]"
            >
              Editar HCP
            </button>
          )}
          {!isEditing && !p.isMe && (
            <button onClick={() => setAsMe(p.id)} className="text-[var(--fairway)]">
              Soy yo
            </button>
          )}
          {!isEditing && (
            <button onClick={() => remove(p)} className="text-[var(--red)]">
              Borrar
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {me && renderPlayer(me)}

      <input
        className="gf-input"
        placeholder={`Buscar entre ${others.length} jugadores...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() === "" && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-[var(--fairway)] underline w-full text-center py-1"
        >
          Mostrar todos ({others.length})
        </button>
      )}
      {query.trim() === "" && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-[var(--muted)] underline w-full text-center py-1"
        >
          Ocultar lista
        </button>
      )}

      {filteredOthers.map(renderPlayer)}

      {query.trim() !== "" && filteredOthers.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          Sin resultados
        </Card>
      )}

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="gf-card !p-3 text-center text-[var(--fairway)] font-semibold border-dashed w-full"
        >
          + Agregar jugador
        </button>
      ) : (
        <Card className="!p-3 space-y-2">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
            Agregar jugador
          </div>
          <input
            className="gf-input"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="gf-input"
            placeholder="HCP (opcional, ej 8.9)"
            inputMode="decimal"
            value={hcp}
            onChange={(e) => setHcp(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMe}
              onChange={(e) => setIsMe(e.target.checked)}
            />
            Soy yo
          </label>
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="gf-btn flex-1">
              {busy ? "Guardando..." : "Agregar"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setName("");
                setHcp("");
                setIsMe(false);
              }}
              disabled={busy}
              className="gf-btn gf-btn-secondary px-4"
            >
              Cancelar
            </button>
          </div>
        </Card>
      )}

      {mergeFrom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <Card className="w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                No se puede borrar
              </div>
              <div className="font-semibold mt-1">{mergeFrom.player.name}</div>
              <div className="text-sm text-[var(--muted)]">
                Tiene {mergeFrom.rounds} ronda{mergeFrom.rounds === 1 ? "" : "s"} asociada
                {mergeFrom.rounds === 1 ? "" : "s"}.
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                Opción A · Fusionar con otro jugador
              </div>
              <p className="text-[11px] text-[var(--muted)] mb-2">
                Mueve sus rondas al jugador elegido y borra este. Útil para duplicados.
              </p>
              <select
                className="gf-input"
                value={mergeInto}
                onChange={(e) => setMergeInto(e.target.value)}
              >
                <option value="">— Elegir jugador destino —</option>
                {players
                  .filter((p) => p.id !== mergeFrom.player.id)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isMe ? "(YO)" : ""}
                    </option>
                  ))}
              </select>
              <button
                onClick={doMerge}
                disabled={!mergeInto || busy}
                className="gf-btn w-full mt-2"
              >
                {busy ? "Fusionando..." : "Fusionar"}
              </button>
            </div>

            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                Opción B · Borrar igual
              </div>
              <p className="text-[11px] text-[var(--muted)] mb-2">
                Elimina al jugador y sus participaciones en {mergeFrom.rounds} ronda
                {mergeFrom.rounds === 1 ? "" : "s"}. Las rondas quedan, pero sin sus datos.
              </p>
              <button
                onClick={forceDelete}
                disabled={busy}
                className="gf-btn gf-btn-secondary w-full"
                style={{ color: "var(--red)" }}
              >
                Borrar con sus datos
              </button>
            </div>

            <button
              onClick={() => {
                setMergeFrom(null);
                setMergeInto("");
              }}
              disabled={busy}
              className="text-xs text-[var(--muted)] underline w-full text-center py-1"
            >
              Cancelar
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
