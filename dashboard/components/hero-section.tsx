"use client";

import { RESEARCHERS, PAPER, REPO } from "@/lib/config";
import { useT } from "@/lib/i18n";

// Inline literal so Next.js' build-time NEXT_PUBLIC_* substitution turns
// this into a constant boolean, letting the bundler dead-code-eliminate the
// "(anonymized for review)" annotation entirely on the GitHub Pages build.
// The NeurIPS 2026 venue badge is shown on every build.
const IS_ANON_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";

export function HeroSection() {
  const t = useT();
  return (
    <section className="pt-12 sm:pt-20 pb-8 sm:pb-10 max-w-[800px] mx-auto px-4 sm:px-6 text-center">
      <p className="mb-4 sm:mb-5 flex justify-center">
        <span className="inline-flex items-center justify-center text-center rounded-2xl sm:rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 sm:py-0.5 text-[11px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] text-emerald-500 font-semibold">
          NeurIPS 2026 Evaluations &amp; Datasets Track
        </span>
      </p>
      <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight bg-gradient-to-b from-foreground to-foreground/75 bg-clip-text text-transparent">
        CyBiasBench
      </h1>
      <p className="mt-3 sm:mt-4 text-lg sm:text-xl md:text-2xl text-foreground/80 leading-snug text-balance">
        {t(
          "Attack Bias of Agents in AI Security",
          "AI 보안에서의 에이전트의 공격 편향"
        )}
      </p>

      <div className="mt-8 sm:mt-10">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-7">
          {RESEARCHERS.map((r) => (
            <div key={r.name} className="flex flex-col items-center">
              <span className="text-[15px] sm:text-base text-foreground/90">
                {r.name}
                {r.equal && <sup className="text-muted-foreground ml-0.5">*</sup>}
                {r.corresponding && <sup className="text-muted-foreground ml-0.5">†</sup>}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">{r.affiliation}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/80 mt-3">
          {IS_ANON_INLINE && (
            <>{t("Authors anonymized for review", "심사를 위해 저자 익명 처리")} &nbsp;·&nbsp; </>
          )}
          {t(
            <>
              <sup>*</sup> Equal contribution &nbsp;·&nbsp; <sup>†</sup> Corresponding authors
            </>,
            <>
              <sup>*</sup> 동등 기여 &nbsp;·&nbsp; <sup>†</sup> 교신저자
            </>
          )}
        </p>
      </div>

      {(PAPER.href || REPO.url) && (
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {PAPER.href && (
            <a
              href={PAPER.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <span>{PAPER.label}</span>
              <span aria-hidden className="text-muted-foreground">↗</span>
            </a>
          )}
          {REPO.url && (
            <a
              href={REPO.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <span>{REPO.label}</span>
              <span aria-hidden className="text-muted-foreground">↗</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
