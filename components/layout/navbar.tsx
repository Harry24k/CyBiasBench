"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "methodology", label: "Methodology" },
  { id: "analysis", label: "S1 Analysis" },
  { id: "scenario2", label: "S2 Analysis" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("cybiasbench-theme");
    if (stored === "light") setTheme("light");
    else setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.className = next === "light" ? "light" : "";
    localStorage.setItem("cybiasbench-theme", next);
  }, [theme]);

  return (
    <button
      onClick={toggle}
      className="ml-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export function Navbar() {
  const [active, setActive] = useState("summary");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Prevent hash-based auto-scroll on refresh
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
      window.scrollTo(0, 0);
    }
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-[1500px] mx-auto px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="font-serif text-lg text-foreground">
            CyBiasBench
          </span>
        </button>

        <div className="flex items-center gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer",
                active === s.id
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s.label}
            </button>
          ))}
          <a
            href="https://github.com/Harry24k/CyBiasBench"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
