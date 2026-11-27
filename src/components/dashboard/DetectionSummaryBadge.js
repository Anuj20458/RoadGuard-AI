"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { formatConfidencePercent } from "@/lib/formatters";

/**
 * Displays a consistent AI pothole detection badge across complaint cards and
 * inspection views, distinguishing three states:
 * 1. Completed detection with pothole(s) detected
 * 2. Completed detection with no pothole flagged
 * 3. Unavailable or non-pothole manual review
 *
 * @param {{
 *   detection: {
 *     detected?: boolean,
 *     confidence?: number,
 *     boundingBoxes?: Array<unknown>,
 *     modelName?: string,
 *   } | null | undefined,
 *   reportCategory?: string,
 *   compact?: boolean,
 * }} props
 */
export default function DetectionSummaryBadge({
  detection,
  reportCategory = "pothole",
  compact = false,
}) {
  const { t } = useLanguage();

  if (!detection) {
    const isNonPothole = reportCategory && reportCategory !== "pothole";
    const badgeLabel = isNonPothole ? t("aiManualReview") : t("aiUnavailable");

    if (compact) {
      return (
        <span className="inline-flex items-center rounded-xs border border-[#DEDCCF] bg-[#F4F1E8] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#777B70]">
          {badgeLabel}
        </span>
      );
    }

    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-xs border border-[#DEDCCF] bg-[#F4F1E8] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#777B70]">
          {badgeLabel}
        </span>
        <p className="font-mono text-[10px] text-[#777B70]">
          {t("aiManualReview")}
        </p>
      </div>
    );
  }

  const boxCount = Array.isArray(detection.boundingBoxes)
    ? detection.boundingBoxes.length
    : 0;
  const confidenceText = formatConfidencePercent(detection.confidence);
  const boxLabel = `${boxCount} ${boxCount === 1 ? t("aiBoxSingular") : t("aiBoxPlural")}`;

  if (detection.detected) {
    if (compact) {
      return (
        <span className="inline-flex items-center rounded-xs border border-[#233B32]/35 bg-[#233B32]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#233B32]">
          {t("aiDetected")} · {confidenceText} ({boxCount})
        </span>
      );
    }

    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-xs border border-[#233B32]/35 bg-[#233B32]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#233B32]">
          {t("aiDetected")}
        </span>
        <p className="font-mono text-[10px] text-[#777B70]">
          {confidenceText} · {boxLabel}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center rounded-xs border border-[#A65F45]/35 bg-[#A65F45]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#864832]">
        {t("aiNoPothole")} · {confidenceText} ({boxCount})
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      <span className="inline-flex items-center gap-1.5 rounded-xs border border-[#A65F45]/35 bg-[#A65F45]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#864832]">
        {t("aiNoPothole")}
      </span>
      <p className="font-mono text-[10px] text-[#777B70]">
        {confidenceText} · {boxLabel} · {t("aiManualReview")}
      </p>
    </div>
  );
}
