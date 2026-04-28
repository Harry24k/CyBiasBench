"use client";

import { FadeIn } from "@/components/fade-in";
import type { PaperSummary } from "@/lib/types";
import { Layer1Observation } from "./layer1-observation";
import { Layer2Decoupling } from "./layer2-decoupling";
import { Layer3Injection } from "./layer3-injection";

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

export function FindingsSection({ data }: { data: PaperSummary }) {
  const h = data.headline_stats;

  const KEY_FINDINGS = [
    {
      stat: `p = ${formatP(h.kruskal_H.p)}`,
      label: "Behavioral profiles are model-specific",
      desc: `Kruskal–Wallis across 5 agents on attack-family entropy H(X). η² = ${h.kruskal_H.eta2.toFixed(3)} (large). Profiles stable across prompt conditions.`,
      sample: "n = 180 S1 sessions",
      tone: "bias" as const,
    },
    {
      stat: `ρ = ${h.asr_transfer.rho >= 0 ? "+" : ""}${h.asr_transfer.rho.toFixed(3)}`,
      label: "Per-family ASR transfers across settings",
      desc: `Spearman correlation between free-choice ASRᵢ (S1) and forced-injection target ASR (S2). p = ${formatP(h.asr_transfer.p)}.`,
      sample: `n = ${h.asr_transfer.n} (agent × family) cells`,
      tone: "performance" as const,
    },
    {
      stat: h.all_negative_delta_asr ? "ΔASR ≤ 0" : `ΔASR mixed`,
      label: "Forced injection fails to improve outcomes",
      desc: `All 5 agents show non-positive ΔASR from observation to injection. Compliance tracks preference (ρ = ${h.compliance_sel.rho.toFixed(3)}), not capability.`,
      sample: "n = 450 S2 sessions (5 × 10 × 3 × 3)",
      tone: "injection" as const,
    },
  ];

  return (
    <div className="space-y-24">
      <FadeIn>
        <div className="max-w-[1500px] mx-auto px-6 space-y-6">
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Paper metric groups (Table 1) + Bias Injection (§5)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <AxisLegend
                tone="bias"
                title="Bias Evaluation"
                metrics="H(X) · Selᵢ"
                question="How does the agent allocate effort?"
                layer="Layer 1 — Bias Observation"
              />
              <AxisLegend
                tone="performance"
                title="Attack Performance"
                metrics="ASR · ASRᵢ"
                question="Does that allocation succeed?"
                layer="Layer 2 — Selection ≠ Performance"
              />
              <AxisLegend
                tone="efficiency"
                title="Efficiency & Robustness"
                metrics="TPS · JSD"
                question="Is the cost/stability bridged across bias and performance?"
                layer="Layer 1 (JSD) · Overview (TPS)"
              />
              <AxisLegend
                tone="injection"
                title="Bias Injection (§5)"
                metrics="C · ΔASR"
                question="Can prompt steering reshape the allocation?"
                layer="Layer 3 — Bias Injection"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {KEY_FINDINGS.map((f) => (
              <div
                key={f.label}
                className={`rounded-xl border-2 bg-card p-5 ${
                  f.tone === "bias"
                    ? "border-indigo-500/50"
                    : f.tone === "performance"
                    ? "border-emerald-500/50"
                    : "border-rose-500/50"
                }`}
              >
                <span className="text-3xl font-mono font-bold text-foreground">{f.stat}</span>
                <p className="text-sm font-semibold text-foreground mt-2">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                <p className="text-[11px] font-mono text-muted-foreground/80 mt-3 pt-2 border-t border-border/60">
                  {f.sample}
                </p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      <Layer1Observation data={data} />
      <Layer2Decoupling data={data} />
      <Layer3Injection data={data} />
    </div>
  );
}

function AxisLegend({
  tone,
  title,
  metrics,
  question,
  layer,
}: {
  tone: "bias" | "performance" | "efficiency" | "injection";
  title: string;
  metrics: string;
  question: string;
  layer: string;
}) {
  const dot =
    tone === "bias"
      ? "bg-indigo-500"
      : tone === "performance"
      ? "bg-emerald-500"
      : tone === "efficiency"
      ? "bg-amber-500"
      : "bg-rose-500";
  const label =
    tone === "bias"
      ? "text-indigo-400"
      : tone === "performance"
      ? "text-emerald-400"
      : tone === "efficiency"
      ? "text-amber-400"
      : "text-rose-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${label}`}>{title}</span>
        <span className="text-xs font-mono text-muted-foreground">{metrics}</span>
      </div>
      <p className="text-xs italic text-muted-foreground">{question}</p>
      <p className="text-[11px] font-mono text-muted-foreground/70">{layer}</p>
    </div>
  );
}
