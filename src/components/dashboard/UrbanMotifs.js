"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * Custom RoadGuard AI brand wordmark with an understated road-corridor
 * and surveyor grid emblem.
 *
 * @param {{ compact?: boolean }} props
 */
export function RoadGuardWordmark({ compact = false }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3">
      <svg
        width="34"
        height="34"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="2"
          fill="#233B32"
          stroke="#233B32"
          strokeWidth="1.5"
        />
        {/* Outer surveyor corner ticks */}
        <path
          d="M6 10V6H10M26 6H30V10M30 26V30H26M10 30H6V26"
          stroke="#DEDCCF"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        {/* Perspective roadway edges */}
        <path
          d="M11 29L15.5 8M25 29L20.5 8"
          stroke="#F4F1E8"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        {/* Dashed road centerline */}
        <path
          d="M18 10V13.5M18 17V21M18 24.5V28"
          stroke="#A65F45"
          strokeWidth="1.6"
          strokeLinecap="square"
        />
      </svg>

      <div className="leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-[#292D2A]">
            RoadGuard
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-[#A65F45]">
            AI
          </span>
        </div>
        {!compact && (
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[#777B70]">
            {t("brandSubtitle")}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Subtle topographic elevation contour lines used as a quiet architectural
 * backdrop inside the welcome brief.
 */
export function TopographicContours() {
  return (
    <svg
      viewBox="0 0 420 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="pointer-events-none h-full w-full select-none text-[#233B32]"
    >
      <path
        d="M38 196C90 158 148 164 202 126C256 88 288 32 372 18"
        stroke="currentColor"
        strokeOpacity="0.09"
        strokeWidth="1"
      />
      <path
        d="M74 208C124 174 176 180 224 146C272 112 312 62 394 48"
        stroke="currentColor"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      <path
        d="M118 214C166 188 210 192 252 162C294 132 336 94 412 82"
        stroke="currentColor"
        strokeOpacity="0.07"
        strokeWidth="1"
      />
      <path
        d="M174 216C214 196 248 198 284 176C320 154 358 128 418 118"
        stroke="#A65F45"
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      {/* Subtle surveyor crosshair */}
      <path
        d="M326 68V84M318 76H334"
        stroke="#A65F45"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <circle
        cx="326"
        cy="76"
        r="11"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * Minimal horizontal architectural divider inspired by road lane markings.
 */
export function RoadLineDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {label && (
        <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#777B70]">
          {label}
        </span>
      )}
      <div className="relative h-px flex-1 bg-[#DEDCCF]">
        <span
          aria-hidden="true"
          className="absolute right-0 top-1/2 h-1.5 w-6 -translate-y-1/2 border-t border-dashed border-[#A65F45]/60"
        />
      </div>
    </div>
  );
}
