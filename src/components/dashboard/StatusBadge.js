"use client";

import { useLanguage } from "@/components/LanguageProvider";

const STATUS_STYLES = {
  pending: {
    label: "Pending",
    dot: "bg-[#A65F45]",
    classes: "border-[#A65F45]/35 bg-[#A65F45]/10 text-[#864832]",
  },
  verified: {
    label: "Verified",
    dot: "bg-[#233B32]",
    classes: "border-[#233B32]/30 bg-[#233B32]/8 text-[#233B32]",
  },
  assigned: {
    label: "Assigned",
    dot: "bg-[#292D2A]",
    classes: "border-[#DEDCCF] bg-[#ECE8DA] text-[#292D2A]",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-[#9A6A32]",
    classes: "border-[#9A6A32]/35 bg-[#9A6A32]/10 text-[#724E24]",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-[#F4F1E8]",
    classes: "border-[#233B32] bg-[#233B32] text-[#F4F1E8]",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-[#777B70]",
    classes: "border-[#DEDCCF] bg-[#F4F1E8] text-[#777B70]",
  },
};

const PRIORITY_STYLES = {
  low: {
    label: "Low",
    classes: "text-[#777B70] border-[#DEDCCF]",
  },
  medium: {
    label: "Medium",
    classes: "text-[#292D2A] border-[#DEDCCF]",
  },
  high: {
    label: "High",
    classes: "text-[#233B32] border-[#233B32]/35 bg-[#233B32]/5",
  },
  critical: {
    label: "Critical",
    classes: "text-[#864832] border-[#A65F45]/45 bg-[#A65F45]/10",
  },
};

/**
 * Displays a refined civic status indicator for a complaint status.
 *
 * @param {{ status: string }} props
 */
export function StatusBadge({ status }) {
  const { t } = useLanguage();
  const config = STATUS_STYLES[status] || {
    label: status || "Unknown",
    dot: "bg-[#777B70]",
    classes: "border-[#DEDCCF] bg-[#F4F1E8] text-[#292D2A]",
  };
  const translatedLabel = STATUS_STYLES[status]
    ? t(`status_${status}`)
    : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {translatedLabel}
    </span>
  );
}

/**
 * Displays an understated typographic priority indicator for a complaint.
 *
 * @param {{ priority: string }} props
 */
export function PriorityBadge({ priority }) {
  const { t } = useLanguage();
  const config = PRIORITY_STYLES[priority] || {
    label: priority || "Normal",
    classes: "text-[#777B70] border-[#DEDCCF]",
  };
  const translatedLabel = PRIORITY_STYLES[priority]
    ? t(`priority_${priority}`)
    : config.label;

  return (
    <span
      className={`inline-flex items-center rounded-xs border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest ${config.classes}`}
    >
      {translatedLabel}
    </span>
  );
}
