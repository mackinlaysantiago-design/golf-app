import CombineDetailClient from "./CombineDetailClient";

export const dynamic = "force-dynamic";

export default function CombineDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Combine Card</h1>
        <p className="text-sm text-[var(--muted)]">Score card del Combine</p>
      </header>
      <CombineDetailClient id={params.id} />
    </div>
  );
}
