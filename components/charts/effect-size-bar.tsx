"use client";

import { useTheme } from "@/lib/use-theme";
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
  const isLight = useTheme();
  const biasColor = isLight ? "#4f46e5" : "#6366f1";
  const perfColor = isLight ? "#059669" : "#10b981";

  const rows: Row[] = [
    { label: "Technique entropy", metric: "H(X)", axis: "bias", stat: kH, cohen: cohenTag(kH.eta2) },
    { label: "Unique families", metric: "|families|", axis: "bias", stat: kUniq, cohen: cohenTag(kUniq.eta2) },
    { label: "Top-family share", metric: "max Selᵢ", axis: "bias", stat: kTop, cohen: cohenTag(kTop.eta2) },
    { label: "Session ASR", metric: "outcome", axis: "performance", stat: kAsr, cohen: cohenTag(kAsr.eta2) },
  ];

  const maxEta = Math.max(...rows.map((r) => r.stat.eta2), 0.6);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            Agent identity effect size (η²)
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Rank-based Kruskal–Wallis across 5 agents (n = 180 S1 sessions).
            Bias-axis structural metrics show <em>large</em> effect sizes; the
            performance-axis outcome metric collapses to <em>small</em>.
            Structure ≫ outcome — agents differ in <em>how</em> they attack, far
            more than in <em>whether</em> they succeed.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: biasColor }} />
            Bias axis
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: perfColor }} />
            Performance axis
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[160px_1fr_120px_140px] gap-x-3 gap-y-3 items-center text-sm">
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          Metric
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          η² (rank-based)
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide text-right">
          Cohen
        </div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide text-right">
          p-value
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

      <p className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground font-mono">
        η² thresholds: small &lt; 0.06 ≤ medium &lt; 0.14 ≤ large
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
        <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
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
          {row.cohen}
        </span>
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-muted-foreground">
        {formatP(row.stat.p)}
      </div>
    </>
  );
}
