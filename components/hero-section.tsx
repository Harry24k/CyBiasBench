"use client";

import { RESEARCHERS, PAPER } from "@/lib/config";
import { BASE_PATH } from "@/lib/utils";
import { useT } from "@/lib/i18n";

// Inline literals so Next.js' build-time NEXT_PUBLIC_* substitution turns
// these into constant booleans, letting the bundler dead-code-eliminate the
// venue eyebrow and the "(anonymized for review)" annotation entirely on
// the GitHub Pages build. Using the imported IS_ANONYMOUS would leave both
// branches of every ternary in the JS chunk — visible to anyone reading
// view-source.
const IS_ANON_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";
const VENUE_VISIBLE_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";

export function HeroSection() {
  const t = useT();
  return (
    <section className="pt-10 sm:pt-24 pb-8 sm:pb-16 max-w-[1500px] mx-auto px-4 sm:px-6 text-center">
      {VENUE_VISIBLE_INLINE && (
        <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3 sm:mb-4">
          NeurIPS 2026 · Evaluations &amp; Datasets Track
        </p>
      )}
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight bg-gradient-to-b from-foreground to-foreground/75 bg-clip-text text-transparent">
        CyBiasBench
      </h1>
      <p className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
        {t(
          "Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
          "사이버 공격 시나리오에서 LLM 에이전트의 편향을 측정하는 벤치마크"
        )}
      </p>

      <p className="mt-6 sm:mt-8 text-base sm:text-lg text-foreground/90 max-w-2xl mx-auto leading-snug text-balance">
        {t(
          <>
            <strong className="text-foreground">Same target, same task — but each agent reaches for a different attack.</strong>{" "}
            And forcing an agent off its preference{" "}
            <strong className="text-foreground">drops</strong> attack success, not raises it.
          </>,
          <>
            <strong className="text-foreground">표적도 과제도 같은데, 에이전트마다 손이 가는 공격이 다름.</strong>{" "}
            게다가 선호와 다른 쪽으로 몰아붙이면 공격 성공률은{" "}
            <strong className="text-foreground">오르기는커녕 떨어짐</strong>.
          </>
        )}
      </p>

      <div className="mt-7 sm:mt-9 mx-auto max-w-4xl rounded-lg border border-border overflow-hidden bg-card p-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE_PATH}/images/main.png`}
          alt={t(
            "Attack-family selection distributions differ sharply across the five evaluated agents",
            "다섯 에이전트의 공격 계열 선택 분포가 서로 확연히 다름을 보여주는 그림"
          )}
          className="w-full h-auto"
        />
      </div>

      <p className="mt-6 text-[11px] sm:text-xs font-mono text-muted-foreground/80">
        {t(
          "5 agents · 3 targets · 4 prompt conditions · 630 sessions",
          "에이전트 5개 · 표적 3개 · 프롬프트 조건 4개 · 세션 630회"
        )}
      </p>

      {PAPER.href && (
        <div className="mt-5 flex justify-center">
          <a
            href={PAPER.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            <span>{PAPER.label}</span>
            <span aria-hidden className="text-muted-foreground">↗</span>
          </a>
        </div>
      )}

      <div className="mt-10 sm:mt-12">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
          {IS_ANON_INLINE
            ? t("Authors (anonymized for review)", "저자 (심사를 위해 익명 처리됨)")
            : t("Authors", "저자")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:gap-x-8">
          {RESEARCHERS.map((r) => (
            <div key={r.name} className="flex flex-col items-center">
              <span className="text-base text-foreground/90">
                {r.name}
                {r.equal && <sup className="text-muted-foreground ml-0.5">*</sup>}
                {r.corresponding && <sup className="text-muted-foreground ml-0.5">†</sup>}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">{r.affiliation}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">
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
    </section>
  );
}
