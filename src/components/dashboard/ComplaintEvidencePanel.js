"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  formatConfidencePercent,
  formatDateTime,
  formatLocation,
  getExternalMapUrl,
} from "@/lib/formatters";
import { StatusBadge } from "./StatusBadge";

const VERIFICATION_BADGE_STYLES = {
  pending: "border-[#9A6A32]/40 bg-[#9A6A32]/10 text-[#724E24]",
  approved: "border-[#233B32] bg-[#233B32] text-[#F4F1E8]",
  rejected: "border-[#864832]/45 bg-[#A65F45]/10 text-[#864832]",
};

/**
 * Shared complaint detail dossier displaying road photo + AI bounding boxes,
 * AI detection metrics, coordinates & external map link, before/after repair
 * evidence, and chronological StatusHistory audit trail.
 *
 * @param {{ complaint: Record<string, any> }} props
 */
export default function ComplaintEvidencePanel({ complaint }) {
  const { t } = useLanguage();
  const [naturalDims, setNaturalDims] = useState(null);

  const boxes = Array.isArray(complaint.detection?.boundingBoxes)
    ? complaint.detection.boundingBoxes
    : [];
  const mapUrl = getExternalMapUrl(complaint.location);
  const repair = complaint.repairVerification;
  const history = Array.isArray(complaint.statusHistory)
    ? complaint.statusHistory
    : [];
  const isPotholeCategory =
    !complaint.reportCategory || complaint.reportCategory === "pothole";

  return (
    <div className="space-y-5 border border-[#DEDCCF] bg-[#EFECE1]/55 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Complaint Image + AI Bounding Boxes */}
        <div className="space-y-2 lg:col-span-7">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
              {t("reportedRoadEvidence")}
            </span>
            {boxes.length > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A65F45]">
                {boxes.length}{" "}
                {boxes.length === 1 ? t("aiBoxSingular") : t("aiBoxPlural")} ·{" "}
                {t("aiOverlayLabel")}
              </span>
            )}
          </div>

          <div className="relative overflow-hidden border border-[#DEDCCF] bg-[#F4F1E8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={complaint.imageUrl}
              alt={`Road surface evidence for ${complaint.title}`}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNaturalDims({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
              }}
              className="block max-h-80 w-full object-contain"
            />

            {complaint.detection?.detected &&
              boxes.length > 0 &&
              naturalDims && (
                <svg
                  viewBox={`0 0 ${naturalDims.width} ${naturalDims.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  aria-label="Stored AI pothole bounding boxes"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  {boxes.map((box, idx) => {
                    const left = Math.max(0, box.x - box.width / 2);
                    const top = Math.max(0, box.y - box.height / 2);
                    const strokeW = Math.max(
                      2,
                      Math.round(naturalDims.width * 0.004)
                    );
                    return (
                      <rect
                        key={`${box.x}-${box.y}-${idx}`}
                        x={left}
                        y={top}
                        width={box.width}
                        height={box.height}
                        fill="rgba(166, 95, 69, 0.16)"
                        stroke="#A65F45"
                        strokeWidth={strokeW}
                      />
                    );
                  })}
                </svg>
              )}
          </div>

          {boxes.length > 0 && (
            <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777B70]">
                {t("boundingBoxCoords")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {boxes.map((box, idx) => (
                  <span
                    key={`${box.x}-${box.y}-${idx}`}
                    className="border border-[#DEDCCF] bg-[#F4F1E8] px-2 py-1 font-mono text-[10px] text-[#292D2A]"
                  >
                    #{idx + 1} {box.class || "pothole"} ·{" "}
                    {formatConfidencePercent(box.confidence)} · (
                    {Math.round(box.x)},{Math.round(box.y)},{" "}
                    {Math.round(box.width)}×{Math.round(box.height)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI & Location Dossier */}
        <div className="space-y-4 lg:col-span-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A65F45]">
              {t("aiLocationDossier")}
            </p>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="text-[#777B70]">{t("reportCategoryLabel")}</dt>
                <dd className="font-mono font-medium text-[#292D2A]">
                  {t(`reportCategory_${complaint.reportCategory || "pothole"}`)}
                </dd>
              </div>
              {complaint.roadType && (
                <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                  <dt className="text-[#777B70]">{t("roadTypeLabel")}</dt>
                  <dd className="font-mono text-[#292D2A]">
                    {t(`roadType_${complaint.roadType}`)}
                  </dd>
                </div>
              )}
              {complaint.authorityCategory && (
                <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                  <dt className="text-[#777B70]">{t("authorityCategoryLabel")}</dt>
                  <dd className="font-mono text-[#292D2A]">
                    {t(`authority_${complaint.authorityCategory}`)}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="text-[#777B70]">{t("aiOutcome")}</dt>
                <dd className="font-mono font-medium text-[#292D2A]">
                  {complaint.detection
                    ? complaint.detection.detected
                      ? t("aiDetected")
                      : t("aiNoPothole")
                    : isPotholeCategory
                      ? t("aiUnavailable")
                      : t("aiManualReview")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="text-[#777B70]">{t("confidenceLabel")}</dt>
                <dd className="font-mono text-[#292D2A]">
                  {complaint.detection
                    ? formatConfidencePercent(complaint.detection.confidence)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="text-[#777B70]">{t("boundingBoxesLabel")}</dt>
                <dd className="font-mono text-[#292D2A]">
                  {complaint.detection ? boxes.length : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="text-[#777B70]">{t("aiModelLabel")}</dt>
                <dd className="truncate font-mono text-[11px] text-[#292D2A]">
                  {complaint.detection?.modelName || t("aiManualReview")}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                <dt className="shrink-0 text-[#777B70]">{t("coordinatesLabel")}</dt>
                <dd className="text-right font-mono text-[11px] text-[#292D2A]">
                  {typeof complaint.location?.latitude === "number" &&
                  typeof complaint.location?.longitude === "number"
                    ? `${complaint.location.latitude.toFixed(5)}°, ${complaint.location.longitude.toFixed(5)}°`
                    : t("status_pending")}
                </dd>
              </div>
              {complaint.citizen && (
                <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                  <dt className="text-[#777B70]">{t("reporterLabel")}</dt>
                  <dd className="truncate text-right text-[#292D2A]">
                    {complaint.citizen.name}{" "}
                    <span className="font-mono text-[10px] text-[#777B70]">
                      ({complaint.citizen.email})
                    </span>
                  </dd>
                </div>
              )}
              {complaint.assignment && (
                <div className="flex items-baseline justify-between gap-2 border-b border-[#DEDCCF] pb-2">
                  <dt className="text-[#777B70]">{t("assignedWorkerLabel")}</dt>
                  <dd className="truncate text-right font-medium text-[#233B32]">
                    {complaint.assignment.workerName}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-3 text-xs leading-5 text-[#292D2A]">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#777B70]">
              {t("incidentDescription")}
            </p>
            <p className="text-[#63675D]">{complaint.description}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#DEDCCF] pt-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-[#292D2A]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A65F45]" />
                <span>{formatLocation(complaint.location)}</span>
              </span>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-[#DEDCCF] bg-[#F4F1E8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#233B32] transition-colors hover:border-[#233B32]"
                >
                  <span>{t("openMap")}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Before / After Repair Verification Evidence */}
      {repair && (
        <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEDCCF] pb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#233B32]">
                {t("fieldRepairEvidence")}
              </p>
              <p className="mt-0.5 text-xs text-[#777B70]">
                {t("submittedByPrefix")}: {repair.workerName} ·{" "}
                {formatDateTime(repair.createdAt)}
              </p>
            </div>
            <span
              className={`rounded-xs border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest ${
                VERIFICATION_BADGE_STYLES[repair.verificationStatus] ||
                "border-[#DEDCCF] bg-[#F4F1E8] text-[#292D2A]"
              }`}
            >
              {t("verificationPrefix")}:{" "}
              {VERIFICATION_BADGE_STYLES[repair.verificationStatus]
                ? t(`verification_${repair.verificationStatus}`)
                : repair.verificationStatus}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#777B70]">
                {t("beforeRepair")}
              </p>
              <div className="overflow-hidden border border-[#DEDCCF] bg-[#F4F1E8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={repair.beforeImage}
                  alt="Before repair road condition"
                  className="block max-h-60 w-full object-contain"
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#233B32]">
                {t("afterRepair")}
              </p>
              <div className="overflow-hidden border border-[#DEDCCF] bg-[#F4F1E8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={repair.afterImage}
                  alt="After repair road condition"
                  className="block max-h-60 w-full object-contain"
                />
              </div>
            </div>
          </div>

          {repair.repairNotes && (
            <div className="mt-4 border border-[#DEDCCF] bg-[#F4F1E8] p-3 text-xs leading-5 text-[#292D2A]">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#777B70]">
                {t("workerRepairNotesLabel")}:{" "}
              </span>
              {repair.repairNotes}
            </div>
          )}
        </div>
      )}

      {/* Chronological Status History Audit Trail */}
      {history.length > 0 && (
        <div className="border border-[#DEDCCF] bg-[#FAF8F2] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#777B70]">
            {t("statusHistoryLedger")}
          </p>
          <ul className="mt-3 divide-y divide-[#DEDCCF]">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.previousStatus && (
                      <>
                        <StatusBadge status={entry.previousStatus} />
                        <span className="font-mono text-[10px] text-[#777B70]">
                          →
                        </span>
                      </>
                    )}
                    <StatusBadge status={entry.newStatus} />
                    <span className="text-[#63675D]">
                      {t("byActor")}{" "}
                      <strong className="font-medium text-[#292D2A]">
                        {entry.changedByName}
                      </strong>
                      {entry.changedByRole
                        ? ` (${
                            entry.changedByRole === "admin"
                              ? t("roleAdmin")
                              : entry.changedByRole === "worker"
                                ? t("roleWorker")
                                : t("roleCitizen")
                          })`
                        : ""}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-xs text-[#63675D]">{entry.note}</p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10px] text-[#777B70]">
                  {formatDateTime(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
