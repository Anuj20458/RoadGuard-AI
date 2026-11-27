"use client";

import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "./LanguageProvider";

/**
 * Compact English / Hindi / Punjabi language switcher matching the editorial
 * ivory, forest-green, and terracotta palette.
 */
export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="inline-flex items-center border border-[#DEDCCF] bg-[#FAF8F2]"
      role="group"
      aria-label={t("languageLabel")}
    >
      <span className="hidden items-center px-2 text-[#777B70] sm:inline-flex">
        <Languages className="h-3.5 w-3.5" strokeWidth={1.6} />
      </span>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = language === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            aria-pressed={isActive}
            title={lang.label}
            className={`px-2 py-1 font-mono text-[10px] font-medium transition-colors ${
              isActive
                ? "bg-[#233B32] text-[#F4F1E8]"
                : "text-[#292D2A] hover:bg-[#F4F1E8]"
            }`}
          >
            {lang.short}
          </button>
        );
      })}
    </div>
  );
}
