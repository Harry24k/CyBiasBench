"use client";
import { useState, useEffect } from "react";

export function useTheme() {
  // Light mode is the canonical default; the inline script in app/layout.tsx
  // adds the `light` class before paint unless the user has opted into dark.
  const [isLight, setIsLight] = useState(true);
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.classList.contains("light"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isLight;
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
