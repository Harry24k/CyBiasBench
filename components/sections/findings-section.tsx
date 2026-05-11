"use client";

import { useState } from "react";
import { FadeIn } from "@/components/fade-in";
import type { PaperSummary } from "@/lib/types";
import { Layer1Observation } from "./layer1-observation";
import { Layer2Decoupling } from "./layer2-decoupling";
import { Layer3Injection } from "./layer3-injection";

const SUPER_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺",
};
function toSuper(s: string): string {
  return s.split("").map((c) => SUPER_MAP[c] ?? c).join("");
}
function formatP(p: number): string {
  if (p < 1e-3) {
    const exp = p.toExponential(2);
    const [mantissa, e] = exp.split("e");
    return `${mantissa}× 10${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

export function FindingsSection({ data }: { data: PaperSummary }) {
  const h = data.headline_stats;

  // Three cards correspond 1:1 to the paper's three layers of findings:
  //  - §4 Bias Observation       → Layer1 (#findings-layer1)
  //  - §4 Selection ≠ Performance → Layer2 (#findings-layer2)
  //  - §5 Bias Injection          → Layer3 (#findings-layer3)
  const KEY_FINDINGS = [
    {
      stat: `η² = ${h.kruskal_H.eta2.toFixed(2)}`,
      label: "Attack-selection bias is agent-specific",
      desc: `Each agent has a distinct allocation profile across the 10 attack families that persists across all four prompt conditions (Kruskal–Wallis on H(X), p = ${formatP(h.kruskal_H.p)}). A random forest identifies the producing agent at ${((h.rf_accuracy ?? 0.65) * 100).toFixed(0)}% accuracy from the selection vector alone.`,
      sample: "180 free-choice sessions",
      tone: "bias" as const,
      href: "#findings-layer1",
      cta: "See Bias Observation →",
    },
    {
      stat: "Selᵢ ⊥ ASRᵢ",
      label: "Selection ≠ Performance",
      desc: `What an agent picks does not track what works. Codex allocates 31.5% to info_disclosure but achieves only 22.1% ASRᵢ on it. Across-agent effect sizes confirm structural metrics (η²(H)=${h.kruskal_H.eta2.toFixed(2)}) separate agents far more strongly than session ASR (η²=${h.kruskal_session_asr.eta2.toFixed(2)}).`,
      sample: "structural ≫ outcome",
      tone: "performance" as const,
      href: "#findings-layer2",
      cta: "See decoupling →",
    },
    {
      stat: h.all_negative_delta_asr ? "ΔASR ≤ 0" : "ΔASR mixed",
      label: "Bias momentum: steering fails to help",
      desc: `Under explicit family steering, compliance follows free-choice preference (ρ = +${h.compliance_sel.rho.toFixed(3)}) — not per-family capability (ρ = ${h.compliance_asri.rho.toFixed(3)}, n.s.). All 5 agents lose session ASR (ΔASR ≤ 0). Capability itself transfers cleanly (ρ = +${h.asr_transfer.rho.toFixed(3)}); the loss is allocation-level.`,
      sample: "450 bias-injection sessions",
      tone: "injection" as const,
      href: "#findings-layer3",
      cta: "See Bias Injection →",
    },
  ];

  return (
    <div className="space-y-24">
      <FadeIn>
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 space-y-6">
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Four metric axes used throughout the dashboard
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <AxisLegend
                tone="bias"
                title="Bias Evaluation"
                metrics="H(X) · Selᵢ"
                question="How does the agent allocate effort?"
                layer="Bias Observation"
              />
              <AxisLegend
                tone="performance"
                title="Attack Performance"
                metrics="ASR · ASRᵢ"
                question="Does that allocation actually succeed?"
                layer="Selection ≠ Performance · ASR transfer"
              />
              <AxisLegend
                tone="efficiency"
                title="Efficiency & Robustness"
                metrics="TPS · JSD"
                question="At what cost, and how stably across prompts?"
                layer="Prompt-stability JSD · Tokens per Success"
              />
              <AxisLegend
                tone="injection"
                title="Bias Injection"
                metrics="C · ΔASR"
                question="Can prompt steering reshape the allocation?"
                layer="Bias Injection setting"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {KEY_FINDINGS.map((f) => (
              <a
                key={f.label}
                href={f.href}
                className={`group flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 border-t-4 transition-colors hover:bg-muted/40 ${
                  f.tone === "bias"
                    ? "border-t-indigo-500/70"
                    : f.tone === "performance"
                    ? "border-t-emerald-500/70"
                    : "border-t-rose-500/60"
                }`}
              >
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-foreground">
                  {f.stat}
                </span>
                <p className="text-sm font-semibold text-foreground mt-2">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground/80">
                    {f.sample}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                    {f.cta}
                  </span>
                </div>
              </a>
            ))}
          </div>

          <SynthesisCard />
        </div>
      </FadeIn>

      <Layer1Observation data={data} />
      <Layer2Decoupling data={data} />
      <Layer3Injection data={data} />
    </div>
  );
}

function SynthesisCard() {
  // Three separable behavioral axes — selection, performance, momentum.
  const COLUMNS = [
    {
      key: "allocation",
      tone: "bias" as const,
      title: "Strategy selection",
      metrics: "H(X) · Selᵢ",
      ref: "Bias Observation",
      blurb: "What an agent chooses to attack.",
      detail:
        "Each agent's allocation profile across the 10 attack families is agent-specific and largely prompt-stable. Single-condition ASR underdescribes agent behavior because the structural attack-selection metrics separate agents an order of magnitude more strongly than session ASR (η²(H)=0.43 vs η²(ASR)=0.05).",
    },
    {
      key: "performance",
      tone: "performance" as const,
      title: "Attack performance",
      metrics: "ASR · ASRᵢ",
      ref: "Selection ≠ Performance",
      blurb: "Whether those attacks actually succeed.",
      detail:
        "Per-family attack performance ASRᵢ is a stable property of each agent: it transfers cleanly from free-choice to bias-injection settings (ρ = +0.702, p = 1.38×10⁻⁸). Capability and selection vary independently — the agent that selects a family most often is rarely the one that succeeds on it most often.",
    },
    {
      key: "momentum",
      tone: "injection" as const,
      title: "Bias momentum",
      metrics: "Compliance · ΔASR",
      ref: "Bias Injection",
      blurb: "How preferences resist explicit steering.",
      detail:
        "Under explicit family-level steering, compliance follows free-choice preference (ρ = +0.529) rather than per-family capability (ρ = −0.248, n.s.). All five agents show ΔASR ≤ 0; performance declines under steering reflect an allocation-level failure, not a capability gap.",
    },
  ];
  const [open, setOpen] = useState(false);

  return (
    <section id="findings-synthesis" className="relative scroll-mt-24 rounded-xl border border-border bg-gradient-to-br from-card via-card to-indigo-500/[0.04] dark:to-indigo-400/[0.05] p-6 space-y-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/60 via-emerald-500/60 to-rose-500/60"
      />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Synthesis
          </p>
          <h3 className="font-serif text-2xl text-foreground mt-1">
            Three separable behavioral axes
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Strategy selection, attack performance, and bias momentum each decouple from the
            others. Outcome-only benchmarks compress these distinct axes into one number;
            CyBiasBench measures them independently.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer self-start"
          aria-expanded={open}
        >
          <span>{open ? "Hide details" : "Read details"}</span>
          <span className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(({ key, ...col }) => (
          <SynthesisColumn key={key} expanded={open} {...col} />
        ))}
      </div>
    </section>
  );
}

function SynthesisColumn({
  tone,
  title,
  metrics,
  ref,
  blurb,
  detail,
  expanded,
}: {
  tone: "bias" | "performance" | "injection";
  title: string;
  metrics: string;
  ref: string;
  blurb: string;
  detail: string;
  expanded: boolean;
}) {
  const accent =
    tone === "bias"
      ? "border-indigo-500/40"
      : tone === "performance"
      ? "border-emerald-500/40"
      : "border-rose-500/40";
  const dot =
    tone === "bias"
      ? "bg-indigo-500"
      : tone === "performance"
      ? "bg-emerald-500"
      : "bg-rose-500";
  const label =
    tone === "bias"
      ? "text-indigo-400"
      : tone === "performance"
      ? "text-emerald-400"
      : "text-rose-400";
  return (
    <div className={`rounded-lg border ${accent} bg-background/40 p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${label}`}>{title}</span>
      </div>
      <p className="text-xs font-mono text-muted-foreground">
        {metrics} <span className="text-muted-foreground/60">· {ref}</span>
      </p>
      <p className="text-sm text-foreground/90">{blurb}</p>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          <p className="text-xs text-muted-foreground leading-relaxed pt-2 mt-2 border-t border-border/60">
            {detail}
          </p>
        </div>
      </div>
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
  href?: string;
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
    <div className="block p-1 space-y-1.5">
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
