"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TocItem = { id: string; label: string; depth?: number };

const TOC: TocItem[] = [
  { id: "overview", label: "Overview" },
  { id: "methodology", label: "Methodology" },
  { id: "m-design", label: "Design", depth: 1 },
  { id: "m-infra", label: "Infrastructure", depth: 1 },
  { id: "m-prompts", label: "Prompts", depth: 1 },
  { id: "m-classify", label: "Classification", depth: 1 },
  { id: "m-metrics", label: "Metrics", depth: 1 },
  { id: "findings", label: "Findings" },
  { id: "findings-layer1", label: "Layer 1", depth: 1 },
  { id: "findings-layer2", label: "Layer 2", depth: 1 },
  { id: "findings-layer3", label: "Layer 3", depth: 1 },
  { id: "findings-synthesis", label: "Synthesis", depth: 1 },
];

export function StickyToc() {
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <aside
      className="hidden lg:block fixed top-32 right-6 z-40 w-[200px] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card/80 backdrop-blur p-3 text-xs"
      aria-label="Table of contents"
    >
      <p className="px-2 pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-0.5">
        {TOC.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => onClick(e, item.id)}
              className={cn(
                "block rounded px-2 py-1 transition-colors",
                item.depth === 1 ? "pl-5" : "font-medium",
                active === item.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
