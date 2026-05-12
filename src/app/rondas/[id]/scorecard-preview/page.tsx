/**
 * Preview de la Advanced Scorecard con data hardcoded.
 */

import { OfficialScorecard } from "@/components/scorecard/OfficialScorecard";
import { SAMPLE_SCORECARD_DATA } from "@/lib/scorecard";

export const dynamic = "force-static";

export default function ScorecardPreviewPage() {
  return (
    <div className="min-h-screen bg-[#e8e8e8] py-6">
      <div className="mx-auto mb-4 max-w-[1400px] px-4 text-sm" style={{ color: "#444" }}>
        <strong>PREVIEW</strong> — TSM Advanced Scorecard con data hardcoded. Solo iterar diseño.
      </div>
      <OfficialScorecard data={SAMPLE_SCORECARD_DATA} />
    </div>
  );
}
