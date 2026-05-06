"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { REPO } from "@/lib/config";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "methodology", label: "Methodology" },
  { id: "findings", label: "Findings" },
];

const FINDINGS_SUBSECTIONS = [
  { id: "findings-layer1", label: "Layer 1 — Observation" },
  { id: "findings-layer2", label: "Layer 2 — Decoupling" },
  { id: "findings-layer3", label: "Layer 3 — Injection" },
  { id: "findings-synthesis", label: "Synthesis" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const stored = localStorage.getItem("cybiasbench-theme");
    if (stored === "dark") setTheme("dark");
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

function FindingsButton({
  active,
  onClickMain,
  onClickSub,
}: {
  active: boolean;
  onClickMain: () => void;
  onClickSub: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={onClickMain}
        className={cn(
          "px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer",
          active
            ? "text-foreground bg-muted"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Findings
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-card/95 backdrop-blur shadow-md py-1 z-50"
        >
          {FINDINGS_SUBSECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setOpen(false);
                onClickSub(s.id);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              role="menuitem"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [active, setActive] = useState("overview");

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
          {SECTIONS.map((s) =>
            s.id === "findings" ? (
              <FindingsButton
                key={s.id}
                active={active === s.id}
                onClickMain={() => scrollTo(s.id)}
                onClickSub={(id) => scrollTo(id)}
              />
            ) : (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "hidden md:inline-flex px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer",
                  active === s.id
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            )
          )}
          {REPO.url ? (
            <a
              href={REPO.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex ml-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              {REPO.label}
            </a>
          ) : (
            <span
              className="hidden md:inline-flex ml-2 px-3 py-1.5 text-sm text-muted-foreground/50 rounded-md cursor-not-allowed"
              title="Anonymous review build"
            >
              {REPO.label}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
