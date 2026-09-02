"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPO } from "@/lib/config";
import { useLang, useT } from "@/lib/i18n";

// Inline literal so the bundler can dead-code-eliminate the
// "Anonymous review build" branch on the GitHub Pages build.
const IS_ANON_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";

interface SubItem {
  id: string;
  label: string;
  labelKo: string;
}
interface NavItem {
  id: string;
  label: string;
  labelKo: string;
  sub?: SubItem[];
}

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", labelKo: "개요" },
  {
    id: "methodology",
    label: "Methodology",
    labelKo: "방법론",
    sub: [
      { id: "m-design", label: "Design", labelKo: "실험 설계" },
      { id: "m-infra", label: "Infrastructure", labelKo: "인프라" },
      { id: "m-prompts", label: "Prompts", labelKo: "프롬프트" },
      { id: "m-classify", label: "Classification", labelKo: "분류" },
      { id: "m-metrics", label: "Metrics", labelKo: "지표" },
    ],
  },
  {
    id: "findings",
    label: "Findings",
    labelKo: "주요 결과",
    sub: [
      { id: "findings-layer1", label: "Bias Observation", labelKo: "편향 관찰" },
      { id: "findings-layer2", label: "Selection ≠ Performance", labelKo: "선택 ≠ 성능" },
      { id: "findings-layer3", label: "Bias Injection", labelKo: "편향 주입" },
      { id: "findings-synthesis", label: "Synthesis", labelKo: "종합" },
    ],
  },
];

const ALL_TRACKED_IDS: string[] = NAV.flatMap((s) => [
  s.id,
  ...(s.sub?.map((x) => x.id) ?? []),
]);

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      className="ml-2 inline-flex items-center rounded-md border border-border overflow-hidden"
      role="group"
      aria-label="Language / 언어"
    >
      {(["en", "ko"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "px-2 py-1 text-[11px] font-mono uppercase tracking-wide transition-colors cursor-pointer",
            lang === code
              ? "text-foreground bg-foreground/[0.07]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {code === "en" ? "EN" : "한"}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const stored = localStorage.getItem("cybiasbench-theme");
    if (stored === "dark") setTheme("dark");
    else
      setTheme(
        document.documentElement.classList.contains("light") ? "light" : "dark"
      );
  }, []);

  const t = useT();

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
      aria-label={t("Toggle theme", "테마 전환")}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function NavDropdown({
  item,
  parentActive,
  activeSub,
  onClickMain,
  onClickSub,
}: {
  item: NavItem;
  parentActive: boolean;
  activeSub: string | null;
  onClickMain: (id: string) => void;
  onClickSub: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  };

  // Click outside / Escape closes the menu (keeps hover UX intact).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative hidden md:block"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => {
          onClickMain(item.id);
          setOpen(false);
        }}
        className={cn(
          "px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer inline-flex items-center gap-1",
          parentActive
            ? "text-foreground bg-foreground/[0.07]"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t(item.label, item.labelKo)}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && item.sub && (
        <div
          role="menu"
          className="absolute right-0 top-full pt-1 w-72 z-[100]"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="rounded-md border border-border bg-card shadow-lg py-1">
            {item.sub.map((s) => {
              const isActive = activeSub === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onClickSub(s.id);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer",
                    isActive
                      ? "text-foreground bg-foreground/[0.07] font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                >
                  {t(s.label, s.labelKo)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMenu({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleNavigate = (id: string) => {
    setOpen(false);
    // Defer scroll until after the sheet unmounts and body scroll lock releases.
    requestAnimationFrame(() => onNavigate(id));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        aria-label={open ? t("Close menu", "메뉴 닫기") : t("Open menu", "메뉴 열기")}
        aria-expanded={open}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mounted && open &&
        createPortal(
          <div
            className="fixed inset-x-0 top-14 bottom-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 top-0 max-h-full overflow-y-auto bg-background border-b border-border shadow-lg">
              <div className="px-4 py-3 flex flex-col">
                {NAV.map((item) => {
                  const parentActive =
                    active === item.id ||
                    !!item.sub?.some((s) => s.id === active);
                  return (
                    <div key={item.id} className="py-1">
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-md text-base font-medium transition-colors cursor-pointer",
                          parentActive
                            ? "text-foreground bg-foreground/[0.07]"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        {t(item.label, item.labelKo)}
                      </button>
                      {item.sub && (
                        <div className="mt-1 ml-3 border-l border-border pl-2 flex flex-col">
                          {item.sub.map((s) => {
                            const isActive = active === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleNavigate(s.id)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                                  isActive
                                    ? "text-foreground bg-foreground/[0.07] font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                )}
                              >
                                {t(s.label, s.labelKo)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="mt-2 pt-3 border-t border-border">
                  {IS_ANON_INLINE ? (
                    <span
                      className="block w-full px-3 py-2.5 text-base text-muted-foreground/50 rounded-md cursor-not-allowed"
                      title={t("Anonymous review build", "익명 심사용 배포본")}
                    >
                      {REPO.label}
                    </span>
                  ) : (
                    <a
                      href={REPO.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="block w-full px-3 py-2.5 text-base text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    >
                      {REPO.label}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function Navbar() {
  // Track every section + subsection separately so the active state can
  // reflect the deepest visible region (e.g. findings-layer2).
  const t = useT();
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const visible = new Set<string>();
    let pending = false;
    let lastActive: string | null = null;

    const order = (id: string) => {
      const i = ALL_TRACKED_IDS.indexOf(id);
      return i < 0 ? Infinity : i;
    };
    const isSub = (id: string) =>
      id.startsWith("m-") || id.startsWith("findings-");

    const recompute = () => {
      pending = false;
      if (visible.size === 0) return;
      let best: string | null = null;
      let bestScore = -Infinity;
      for (const id of visible) {
        const score = (isSub(id) ? 1000 : 0) - order(id);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best && best !== lastActive) {
        lastActive = best;
        setActive(best);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Coalesce rapid intersection bursts during scroll into a single
        // recompute per animation frame; avoids per-frame setState/repaint
        // of the sticky navbar.
        if (!pending) {
          pending = true;
          requestAnimationFrame(recompute);
        }
      },
      // Single boundary check (threshold=0) is enough; multi-threshold caused
      // many redundant callbacks during scroll which thrashed the layout.
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );

    ALL_TRACKED_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
      window.scrollTo(0, 0);
    }
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isParentActive = (item: NavItem): boolean => {
    if (active === item.id) return true;
    return !!item.sub?.some((s) => s.id === active);
  };
  const activeSubOf = (item: NavItem): string | null => {
    return item.sub?.find((s) => s.id === active)?.id ?? null;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="max-w-[1500px] mx-auto px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="font-serif text-lg text-foreground">CyBiasBench</span>
        </button>

        <div className="flex items-center gap-1">
          {NAV.map((item) =>
            item.sub ? (
              <NavDropdown
                key={item.id}
                item={item}
                parentActive={isParentActive(item)}
                activeSub={activeSubOf(item)}
                onClickMain={scrollTo}
                onClickSub={scrollTo}
              />
            ) : (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "hidden md:inline-flex px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer",
                  active === item.id
                    ? "text-foreground bg-foreground/[0.07]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {t(item.label, item.labelKo)}
              </button>
            )
          )}
          {IS_ANON_INLINE ? (
            <span
              className="hidden md:inline-flex ml-2 px-3 py-1.5 text-sm text-muted-foreground/50 rounded-md cursor-not-allowed"
              title={t("Anonymous review build", "익명 심사용 배포본")}
            >
              {REPO.label}
            </span>
          ) : (
            <a
              href={REPO.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex ml-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              {REPO.label}
            </a>
          )}
          <LangToggle />
          <ThemeToggle />
          <MobileMenu active={active} onNavigate={scrollTo} />
        </div>
      </div>
    </nav>
  );
}
