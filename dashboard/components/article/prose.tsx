"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Typography primitives for the long-form article. Every element sits in the
 * same 800px column as the figures so text and charts share one reading line.
 */

export const COLUMN = "max-w-[800px] mx-auto px-4 sm:px-6";

/** Bilingual paragraph. */
export function P({ en, ko, className }: { en: ReactNode; ko: ReactNode; className?: string }) {
  const t = useT();
  return (
    <p
      className={cn(
        "text-[16px] sm:text-[17px] leading-[1.85] text-foreground/85 [&_strong]:text-foreground [&_strong]:font-semibold",
        className,
      )}
    >
      {t(en, ko)}
    </p>
  );
}

/** A highlighted single-sentence statement (the article's bold questions / takeaways). */
export function Pull({ en, ko }: { en: ReactNode; ko: ReactNode }) {
  const t = useT();
  return (
    <p className="my-2 border-l-[3px] border-foreground/70 pl-4 sm:pl-5 text-[17px] sm:text-lg leading-relaxed font-semibold text-foreground">
      {t(en, ko)}
    </p>
  );
}

/** Prose block: a column of paragraphs with consistent rhythm. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(COLUMN, "space-y-5", className)}>{children}</div>;
}

/** Chapter heading with its number. `id` is the scroll target used by the navbar. */
export function Chapter({
  id,
  num,
  en,
  ko,
  children,
}: {
  id: string;
  num: number;
  en: string;
  ko: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <header className={cn(COLUMN, "mb-6 sm:mb-8")}>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {String(num).padStart(2, "0")}
        </p>
        <h2 className="mt-2 font-serif text-[26px] sm:text-[32px] leading-[1.25] text-foreground text-balance">
          {t(en, ko)}
        </h2>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Spacing wrapper around an existing dashboard block so it reads as a figure in the text. */
export function Figure({ children }: { children: ReactNode }) {
  return <div className="py-6 sm:py-8">{children}</div>;
}

/** Thin horizontal rule in the column. */
export function Rule() {
  return (
    <div className={COLUMN}>
      <div className="h-px bg-border" />
    </div>
  );
}
