import CombineClient from "./CombineClient";

export const dynamic = "force-dynamic";

export default function CombinePage() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">The Combine</h1>
        <p className="text-sm text-[var(--muted)]">
          5 tests fijos de habilidad · mismo protocolo siempre · comparalo en el tiempo
        </p>
      </header>
      <CombineClient />
    </div>
  );
}
