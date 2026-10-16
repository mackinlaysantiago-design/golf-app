import NuevoCombineClient from "./NuevoCombineClient";

export const dynamic = "force-dynamic";

export default function NuevoCombinePage() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Nuevo Combine</h1>
        <p className="text-sm text-[var(--muted)]">Cargá los 5 tests, uno por vez</p>
      </header>
      <NuevoCombineClient />
    </div>
  );
}
