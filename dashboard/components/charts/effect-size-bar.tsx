"use client";

import { useTheme } from "@/lib/use-theme";
import { useT } from "@/lib/i18n";
import type { KruskalStat } from "@/lib/types";

const SUPER_MAP: Record<string, string> = {
  "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074",
  "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
  "-": "\u207B", "+": "\u207A",
};
function toSuper(s: string): string {
  return s.split("").map((c) => SUPER_MAP[c] ?? c).join("");
}
function formatP(p: number): string {
  if (p < 1e-3) {
    const exp = p.toExponential(2);
    const [mantissa, e] = exp.split("e");
    return `${mantissa}\u00D7\u200910${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

type Axis = "bias" | "performance";

interface Row {
  label: string;
  metric: string;
  axis: Axis;
  stat: KruskalStat;
  cohen: "small" | "medium" | "large";
}

function cohenTag(eta2: number): "small" | "medium" | "large" {
  if (eta2 >= 0.14) return "large";
  if (eta2 >= 0.06) return "medium";
  return "small";
}

export function EffectSizeBar({
  kH,
  kUniq,
  kTop,
  kAsr,
}: {
  kH: KruskalStat;
  kUniq: KruskalStat;
  kTop: KruskalStat;
  kAsr: KruskalStat;
}) {
  const t = useT();
  const isLight = useTheme();
  const biasColor = isLight ? "#4f46e5" : "#6366f1";
  const perfColor = isLight ? "#059669" : "#10b981";

  const rows: Row[] = [
    { label: t("Technique entropy", "기법 엔트로피"), metric: "H(X)", axis: "bias", stat: kH, cohen: cohenTag(kH.eta2) },
    { label: t("Unique families", "고유 계열 수"), metric: "|families|", axis: "bias", stat: kUniq, cohen: cohenTag(kUniq.eta2) },
    { label: t("Selection CR1", "선택 CR1"), metric: t("max within-session selection share", "세션 내 최대 선택 비중"), axis: "bias", stat: kTop, cohen: cohenTag(kTop.eta2) },
    { label: t("Session ASR", "세션 ASR"), metric: t("outcome", "결과"), axis: "performance", stat: kAsr, cohen: cohenTag(kAsr.eta2) },
  ];

  const maxEta = Math.max(...rows.map((r) => r.stat.eta2), 0.6);

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            {t("Agent identity effect size (η²)", "에이전트 정체성의 효과크기 (η²)")}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {t(
              <>
                Rank-based Kruskal–Wallis across 5 agents (n = 180 observation sessions).
                Bias-axis structural metrics show <em>large</em> effect sizes; the
                performance-axis outcome metric collapses to <em>small</em>.
                Structure ≫ outcome — agents differ in <em>how</em> they attack, far
                more than in <em>whether</em> they succeed.
              </>,
              <>
                에이전트 5종에 대한 순위 기반 Kruskal–Wallis 검정임(n = 관찰 세션 180회).
                편향 축의 구조적 지표는 <em>큰</em> 효과크기를 나타내나, 성능 축의 결과 지표는{" "}
                <em>작은</em> 수준에 그침. 구조 ≫ 결과 — 에이전트 간 차이는 성공 <em>여부</em>보다
                공격 <em>방식</em>에서 훨씬 크게 나타남.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: biasColor }} />
            {t("Bias axis", "편향 축")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: perfColor }} />
            {t("Performance axis", "성능 축")}
          </span>
        </div>
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden sm:grid grid-cols-[160px_1fr_120px_140px] gap-x-3 gap-y-3 items-center text-sm">
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          {t("Metric", "지표")}
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          {t("η² (rank-based)", "η² (순위 기반)")}
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide text-right">
          {t("Cohen", "Cohen 기준")}
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide text-right">
          {t("p-value", "p값")}
        </div>

        {rows.map((r) => {
          const color = r.axis === "bias" ? biasColor : perfColor;
          const pct = (r.stat.eta2 / maxEta) * 100;
          return (
            <RowView
              key={r.label}
              row={r}
              color={color}
              pct={pct}
              formatP={formatP}
            />
          );
        })}
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-2.5">
        {rows.map((r) => {
          const color = r.axis === "bias" ? biasColor : perfColor;
          const pct = (r.stat.eta2 / maxEta) * 100;
          const cohenStyle =
            r.cohen === "large"
              ? "bg-foreground/10 text-foreground border-foreground/20"
              : r.cohen === "medium"
              ? "bg-foreground/5 text-muted-foreground border-border"
              : "bg-muted text-muted-foreground border-border";
          return (
            <div
              key={r.label}
              className="rounded-md border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {r.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {r.metric}
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-block px-2 py-0.5 rounded-md text-[10px] font-mono uppercase border ${cohenStyle}`}
                >
                  {t<string>(r.cohen, { small: "작음", medium: "보통", large: "큼" }[r.cohen])}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative h-2 flex-1 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                  />
                </div>
                <span className="font-mono tabular-nums text-foreground text-sm whitespace-nowrap">
                  η² = {r.stat.eta2.toFixed(3)}
                </span>
              </div>
              <div className="mt-1 text-right text-[10px] font-mono tabular-nums text-muted-foreground">
                p = {formatP(r.stat.p)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground font-mono">
        {t(
          <>η² thresholds: small &lt; 0.06 ≤ medium &lt; 0.14 ≤ large</>,
          <>η² 기준: 작음 &lt; 0.06 ≤ 보통 &lt; 0.14 ≤ 큼</>
        )}
      </p>
    </div>
  );
}

function RowView({
  row,
  color,
  pct,
  formatP,
}: {
  row: Row;
  color: string;
  pct: number;
  formatP: (p: number) => string;
}) {
  const t = useT();
  const cohenStyle =
    row.cohen === "large"
      ? "bg-foreground/10 text-foreground border-foreground/20"
      : row.cohen === "medium"
      ? "bg-foreground/5 text-muted-foreground border-border"
      : "bg-muted text-muted-foreground border-border";

  return (
    <>
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{row.label}</span>
        <span className="text-xs text-muted-foreground font-mono">{row.metric}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-2.5 w-full rounded-full bg-foreground/10 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
          />
        </div>
        <span className="font-mono tabular-nums text-foreground whitespace-nowrap min-w-[64px]">
          {row.stat.eta2.toFixed(3)}
        </span>
      </div>
      <div className="text-right">
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-mono uppercase border ${cohenStyle}`}
        >
          {t<string>(row.cohen, { small: "작음", medium: "보통", large: "큼" }[row.cohen])}
        </span>
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-muted-foreground">
        {formatP(row.stat.p)}
      </div>
    </>
  );
}
