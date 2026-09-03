"use client";

import { SITE, REPO, PAPER } from "@/lib/config";
import { useT } from "@/lib/i18n";

// Inline literals — see hero-section.tsx for the same trick. Lets the bundler
// drop both the venue paragraph (NeurIPS string) and the "Anonymous review
// build..." string from the GitHub Pages chunk entirely, not just at render
// time.
const IS_ANON_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";
const VENUE_VISIBLE_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-10 space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="font-serif text-foreground">{SITE.name}</span>
            {" "}&mdash;{" "}
            {t(
              "Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
              "사이버 공격 시나리오에서 LLM 에이전트의 편향을 측정하는 벤치마크"
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
            {PAPER.href ? (
              <a
                href={PAPER.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {PAPER.label}
              </a>
            ) : (
              <span className="text-muted-foreground/60">{PAPER.label}</span>
            )}
            {REPO.url ? (
              <a
                href={REPO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {REPO.label}
              </a>
            ) : (
              <span className="text-muted-foreground/60">{REPO.label}</span>
            )}
            <span>{t("License", "라이선스")}: {SITE.license}</span>
            <span>{SITE.year}</span>
          </div>
        </div>
        {VENUE_VISIBLE_INLINE ? (
          <p className="text-[11px] text-muted-foreground/70">
            {IS_ANON_INLINE
              ? t(
                  "Anonymous review build — author and repository identifiers are masked. Submitted to ",
                  "심사용 익명 배포본임 — 저자와 저장소 정보를 가림. 투고처: "
                )
              : t("Submitted to ", "투고처: ")}
            {SITE.venue}.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">
            {t(
              "Research preview · maintained by the authors.",
              "연구 프리뷰본 · 저자가 직접 관리함."
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
