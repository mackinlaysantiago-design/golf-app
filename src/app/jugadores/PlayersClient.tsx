"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill } from "@/components/ui/Card";

type Player = {
  id: string;
  name: string;
  hcpIndex: number | null;
  isMe: boolean;
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

  async function remove(id: string) {
    if (!confirm("Eliminar jugador?")) return;
    const res = await fetch(`/api/jugadores/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlayers((p) => p.filter((x) => x.id !== id));
      router.refresh();
    }
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

  function renderPlayer(p: Player) {
    return (
      <Card key={p.id} className="!p-3 flex justify-between items-center">
        <div>
          <div className="font-medium flex items-center gap-2">
            {p.name}
            {p.isMe && <Pill variant="accent">YO</Pill>}
          </div>
          {p.hcpIndex != null && (
            <div className="text-xs text-[var(--muted)] gf-mono">
              HCP {p.hcpIndex.toFixed(1)}
            </div>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          {!p.isMe && (
            <button onClick={() => setAsMe(p.id)} className="text-[var(--fairway)]">
              Soy yo
            </button>
          )}
          <button onClick={() => remove(p.id)} className="text-[var(--red)]">
            Borrar
          </button>
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
    </div>
  );
}
