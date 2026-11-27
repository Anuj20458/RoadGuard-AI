"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  translate,
} from "@/lib/i18n";

const STORAGE_KEY = "roadguard_lang";
const VALID_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => translate(DEFAULT_LANGUAGE, key),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && VALID_CODES.has(saved)) {
        // Sync client preference after hydration to avoid SSR mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLanguageState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // Ignore storage access errors in restricted browsers.
    }
  }, []);

  const setLanguage = useCallback((nextCode) => {
    if (!VALID_CODES.has(nextCode)) return;
    setLanguageState(nextCode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextCode);
      document.documentElement.lang = nextCode;
    } catch {
      // Ignore storage write errors.
    }
  }, []);

  const t = useCallback((key) => translate(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
