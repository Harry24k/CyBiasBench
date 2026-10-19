"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Two-locale switch for the site: English (default) and Korean.
 *
 * Copy lives inline at each call site via `t(en, ko)` rather than in a central
 * key table. The page is one long prose document with hundreds of one-off
 * strings, so keeping both languages adjacent keeps edits reviewable and makes
 * a missing translation impossible to hide — an untranslated string simply
 * falls back to English.
 *
 * The provider always renders `en` on the server (the site is a static export,
 * so there is no request-time locale) and adopts the stored preference in an
 * external-store snapshot, which keeps the first client render identical to the prerendered
 * HTML and avoids a hydration mismatch.
 */

export type Lang = "en" | "ko";

const STORAGE_KEY = "cybiasbench:lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
});

function readPreference(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ko" || stored === "en") return stored;
  } catch {
    // Browser preferences still work when storage is disabled.
  }
  return navigator.language?.startsWith("ko") ? "ko" : "en";
}

function subscribePreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("languagechange", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("languagechange", onChange);
  };
}

const englishServerSnapshot = (): Lang => "en";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const preferred = useSyncExternalStore(subscribePreference, readPreference, englishServerSnapshot);
  const [selected, setLangState] = useState<Lang | null>(null);
  const lang = selected ?? preferred;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference is best-effort; the in-memory state still switches.
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "ko" : "en"),
    }),
    [lang, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Picks between an English and a Korean value of the same shape. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback(
    <T,>(en: T, ko?: T): T => (lang === "ko" && ko !== undefined ? ko : en),
    [lang]
  );
}
