/**
 * Preview de la Round Assessment Card con data hardcoded.
 * Usado para iterar el diseño visual sin tocar la DB.
 *
 * URL: /rondas/cualquier-id/card-preview
 */

import { OfficialAssessmentCard } from "@/components/round-assessment-card/OfficialCard";
import { SAMPLE_CARD_DATA } from "@/lib/round-assessment";

export const dynamic = "force-static";

export default function CardPreviewPage() {
  return (
    <div className="min-h-screen bg-[#e8e8e8] py-8">
      <div className="mx-auto mb-6 max-w-[820px] px-4 text-sm" style={{ color: "#444" }}>
        <strong>PREVIEW</strong> — data hardcoded de ejemplo (Santiago, La Lucila, 82). Esta página es solo para iterar el diseño.
      </div>
      <OfficialAssessmentCard data={SAMPLE_CARD_DATA} />
    </div>
  );
}
