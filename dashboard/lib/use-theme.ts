"use client";
import { useCallback, useSyncExternalStore } from "react";

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getTheme = () => document.documentElement.classList.contains("light");
const lightServerSnapshot = () => true;
const falseServerSnapshot = () => false;

export function useTheme() {
  // Light mode is the canonical default; the inline script in app/layout.tsx
  // adds the `light` class before paint unless the user has opted into dark.
  return useSyncExternalStore(subscribeTheme, getTheme, lightServerSnapshot);
}

export function useChartColors() {
  const isLight = useTheme();
  return {
    grid: isLight ? "#e4e4e7" : "#23232a",
    tick: isLight ? "#71717a" : "#b4b4bc",
    tooltipBg: isLight ? "#ffffff" : "#1a1a1e",
    tooltipBorder: isLight ? "#e4e4e7" : "#23232a",
    tooltipText: isLight ? "#18181b" : "#e4e4e7",
  };
}

// Track narrow viewports for layout decisions that Tailwind classes alone
// cannot express (e.g. Recharts pixel heights). Returns false during SSR and
// the first paint, then re-renders once the media query resolves.
export function useIsMobile(maxPx: number = 639) {
  return useMediaQuery(`(max-width: ${maxPx}px)`);
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, falseServerSnapshot);
}

export function useAgentColors(): Record<string, string> {
  const isLight = useTheme();
  return {
    claude: isLight ? "#c97a4f" : "#E8956A",
    codex: isLight ? "#0d8a6a" : "#10A37F",
    gemini: isLight ? "#3572d4" : "#4285F4",
    kimi: isLight ? "#b91c1c" : "#EF4444",
    glm: isLight ? "#7c3aed" : "#A78BFA",
  };
}
