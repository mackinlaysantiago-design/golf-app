import WedgeMatrixClient from "./WedgeMatrixClient";

export const dynamic = "force-dynamic";

export default function WedgeMatrixPage() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Wedge Matrix</h1>
        <p className="text-sm text-[var(--muted)]">
          Distancias conocidas = wedge × posición. Achicá el gap, no alargues el tiro.
        </p>
      </header>
      <WedgeMatrixClient />
    </div>
  );
}
