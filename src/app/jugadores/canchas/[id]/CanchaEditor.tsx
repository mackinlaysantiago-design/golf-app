"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";

type Tee = {
  id: string;
  name: string;
  category: string;
  slopeRating: number;
  courseRating: number;
  parTotal: number;
  slopeIda: number | null;
  courseRatingIda: number | null;
  parIda: number | null;
  slopeVuelta: number | null;
  courseRatingVuelta: number | null;
  parVuelta: number | null;
  notes: string | null;
};

type FormState = {
  name: string;
  category: string;
  slopeRating: string;
  courseRating: string;
  parTotal: string;
  slopeIda: string;
  courseRatingIda: string;
  parIda: string;
  slopeVuelta: string;
  courseRatingVuelta: string;
  parVuelta: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "BLANCO",
  category: "CAB",
  slopeRating: "",
  courseRating: "",
  parTotal: "",
  slopeIda: "",
  courseRatingIda: "",
  parIda: "",
  slopeVuelta: "",
  courseRatingVuelta: "",
  parVuelta: "",
  notes: "",
};

function teeToForm(t: Tee): FormState {
  return {
    name: t.name,
    category: t.category,
    slopeRating: String(t.slopeRating),
    courseRating: String(t.courseRating),
    parTotal: String(t.parTotal),
    slopeIda: t.slopeIda?.toString() ?? "",
    courseRatingIda: t.courseRatingIda?.toString() ?? "",
    parIda: t.parIda?.toString() ?? "",
    slopeVuelta: t.slopeVuelta?.toString() ?? "",
    courseRatingVuelta: t.courseRatingVuelta?.toString() ?? "",
    parVuelta: t.parVuelta?.toString() ?? "",
    notes: t.notes ?? "",
  };
}

export default function CanchaEditor({
  courseId,
  initialTees,
}: {
  courseId: string;
  initialTees: Tee[];
}) {
  const router = useRouter();
  const [tees, setTees] = useState(initialTees);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [showNineHole, setShowNineHole] = useState(false);

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
    setShowNineHole(false);
  }

  function startEdit(t: Tee) {
    setForm(teeToForm(t));
    setEditingId(t.id);
    setShowNineHole(t.slopeIda != null || t.slopeVuelta != null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowNineHole(false);
  }

  function set<K extends keyof FormState>(field: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: v }));
  }

  async function save() {
    if (!form.name.trim() || !form.slopeRating || !form.courseRating || !form.parTotal) {
      alert("Faltan campos obligatorios: nombre, slope, CR, par");
      return;
    }
    setBusy(true);
    const body = {
      name: form.name.trim(),
      category: form.category.trim() || "CAB",
      slopeRating: parseInt(form.slopeRating),
      courseRating: parseFloat(form.courseRating),
      parTotal: parseInt(form.parTotal),
      slopeIda: form.slopeIda ? parseInt(form.slopeIda) : null,
      courseRatingIda: form.courseRatingIda ? parseFloat(form.courseRatingIda) : null,
      parIda: form.parIda ? parseInt(form.parIda) : null,
      slopeVuelta: form.slopeVuelta ? parseInt(form.slopeVuelta) : null,
      courseRatingVuelta: form.courseRatingVuelta ? parseFloat(form.courseRatingVuelta) : null,
      parVuelta: form.parVuelta ? parseInt(form.parVuelta) : null,
      notes: form.notes.trim() || null,
    };
    const res = await fetch(`/api/canchas/${courseId}/tees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      alert("Error guardando tee");
      return;
    }
    const refreshed = await fetch(`/api/canchas/${courseId}/tees`).then((r) => r.json());
    setTees(refreshed);
    cancelEdit();
    router.refresh();
  }

  async function remove(t: Tee) {
    if (!confirm(`¿Borrar tee "${t.name}" (${t.category})?`)) return;
    setBusy(true);
    const res = await fetch(`/api/canchas/${courseId}/tees/${t.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      alert("Error borrando");
      return;
    }
    setTees((prev) => prev.filter((x) => x.id !== t.id));
    router.refresh();
  }

  return (
    <>
      <SectionHeader>Tees · Slope / CR / Par</SectionHeader>
      <p className="text-[11px] text-[var(--muted)] -mt-2">
        Estos valores se usan para auto-calcular el HCP de juego con la fórmula
        WHS: <span className="gf-mono">CH = round(idx × Slope/113 + (CR − Par))</span>
      </p>

      <div className="space-y-2">
        {tees.length === 0 && editingId !== "new" && (
          <Card className="text-center text-sm text-[var(--muted)]">
            Sin tees cargados
          </Card>
        )}

        {tees.map((t) =>
          editingId === t.id ? (
            <TeeForm
              key={t.id}
              form={form}
              set={set}
              showNineHole={showNineHole}
              setShowNineHole={setShowNineHole}
              onSave={save}
              onCancel={cancelEdit}
              busy={busy}
              isNew={false}
            />
          ) : (
            <Card key={t.id} className="!p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {t.name}
                    <Pill>{t.category}</Pill>
                  </div>
                  <div className="text-xs text-[var(--muted)] gf-mono mt-1">
                    Slope {t.slopeRating} · CR {t.courseRating} · Par {t.parTotal}
                  </div>
                  {(t.slopeIda || t.slopeVuelta) && (
                    <div className="text-[10px] text-[var(--muted)] gf-mono mt-0.5">
                      {t.slopeIda && (
                        <>Ida: S{t.slopeIda}/CR{t.courseRatingIda}/P{t.parIda} </>
                      )}
                      {t.slopeVuelta && (
                        <>Vta: S{t.slopeVuelta}/CR{t.courseRatingVuelta}/P{t.parVuelta}</>
                      )}
                    </div>
                  )}
                  {t.notes && (
                    <div className="text-[10px] text-[var(--muted)] mt-1 italic">
                      {t.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => startEdit(t)}
                    className="text-xs text-[var(--fairway)] px-2 py-1"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(t)}
                    className="text-xs text-[var(--red)] px-2 py-1"
                    disabled={busy}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </Card>
          ),
        )}

        {editingId === "new" && (
          <TeeForm
            form={form}
            set={set}
            showNineHole={showNineHole}
            setShowNineHole={setShowNineHole}
            onSave={save}
            onCancel={cancelEdit}
            busy={busy}
            isNew={true}
          />
        )}

        {editingId !== "new" && (
          <button
            onClick={startNew}
            className="gf-card !p-3 text-center text-[var(--fairway)] font-semibold border-dashed w-full"
          >
            + Nuevo tee
          </button>
        )}
      </div>
    </>
  );
}

function TeeForm({
  form,
  set,
  showNineHole,
  setShowNineHole,
  onSave,
  onCancel,
  busy,
  isNew,
}: {
  form: FormState;
  set: <K extends keyof FormState>(field: K, v: FormState[K]) => void;
  showNineHole: boolean;
  setShowNineHole: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  isNew: boolean;
}) {
  return (
    <Card className="space-y-2" style={{ borderLeft: "4px solid var(--accent)" }}>
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {isNew ? "Nuevo tee" : "Editando tee"}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase text-[var(--muted)]">Nombre</label>
          <input
            className="gf-input mt-0.5"
            placeholder="BLANCO / AZUL / NEGRO"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-[var(--muted)]">Categoría</label>
          <select
            className="gf-input mt-0.5"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="CAB">CAB</option>
            <option value="DAM">DAM</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-[var(--muted)]">Slope</label>
          <input
            type="number"
            inputMode="numeric"
            className="gf-input mt-0.5 text-center"
            placeholder="113"
            value={form.slopeRating}
            onChange={(e) => set("slopeRating", e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-[var(--muted)]">CR</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            className="gf-input mt-0.5 text-center"
            placeholder="70.0"
            value={form.courseRating}
            onChange={(e) => set("courseRating", e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-[var(--muted)]">Par</label>
          <input
            type="number"
            inputMode="numeric"
            className="gf-input mt-0.5 text-center"
            placeholder="72"
            value={form.parTotal}
            onChange={(e) => set("parTotal", e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={showNineHole}
          onChange={(e) => setShowNineHole(e.target.checked)}
        />
        <span>Cargar valores ida/vuelta (9 hoyos por separado)</span>
      </label>

      {showNineHole && (
        <>
          <div className="text-[10px] uppercase text-[var(--muted)]">Ida</div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              className="gf-input text-center"
              placeholder="Slope"
              value={form.slopeIda}
              onChange={(e) => set("slopeIda", e.target.value)}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className="gf-input text-center"
              placeholder="CR"
              value={form.courseRatingIda}
              onChange={(e) => set("courseRatingIda", e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              className="gf-input text-center"
              placeholder="Par"
              value={form.parIda}
              onChange={(e) => set("parIda", e.target.value)}
            />
          </div>
          <div className="text-[10px] uppercase text-[var(--muted)]">Vuelta</div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              className="gf-input text-center"
              placeholder="Slope"
              value={form.slopeVuelta}
              onChange={(e) => set("slopeVuelta", e.target.value)}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className="gf-input text-center"
              placeholder="CR"
              value={form.courseRatingVuelta}
              onChange={(e) => set("courseRatingVuelta", e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              className="gf-input text-center"
              placeholder="Par"
              value={form.parVuelta}
              onChange={(e) => set("parVuelta", e.target.value)}
            />
          </div>
        </>
      )}

      <div>
        <label className="text-[10px] uppercase text-[var(--muted)]">Notas</label>
        <textarea
          className="gf-input mt-0.5"
          rows={2}
          placeholder="Fuente / fecha / observaciones"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy} className="gf-btn flex-1">
          {busy ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={onCancel} disabled={busy} className="gf-btn gf-btn-secondary px-4">
          Cancelar
        </button>
      </div>
    </Card>
  );
}
