"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
 * effect, which keeps the first client render identical to the prerendered
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode / storage disabled — stay on the default.
    }
    if (stored === "ko" || stored === "en") {
      setLangState(stored);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.language?.startsWith("ko")) {
      setLangState("ko");
    }
  }, []);

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
