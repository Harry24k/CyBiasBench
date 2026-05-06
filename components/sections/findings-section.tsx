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
                href="#findings-layer1"
              />
              <AxisLegend
                tone="performance"
                title="Attack Performance"
                metrics="ASR · ASRᵢ"
                question="Does that allocation succeed?"
                layer="Layer 2 — Selection ≠ Performance"
                href="#findings-layer2"
              />
              <AxisLegend
                tone="efficiency"
                title="Efficiency & Robustness"
                metrics="TPS · JSD"
                question="Is the cost/stability bridged across bias and performance?"
                layer="Layer 1 (JSD) · Overview (TPS)"
                href="#findings-layer1"
              />
              <AxisLegend
                tone="injection"
                title="Bias Injection (§5)"
                metrics="C · ΔASR"
                question="Can prompt steering reshape the allocation?"
                layer="Layer 3 — Bias Injection"
                href="#findings-layer3"
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
  const COLUMNS = [
    {
      key: "allocation",
      tone: "bias" as const,
      title: "Allocation",
      metrics: "H(X) · Selᵢ",
      ref: "paper §3.3",
      blurb: "How each agent splits effort across the 10 attack families.",
      detail:
        "Each agent concentrates effort on a model-specific subset of attack families that persists across all four prompt conditions; agent identity dominates prompt variation.",
    },
    {
      key: "performance",
      tone: "performance" as const,
      title: "Attack performance",
      metrics: "ASR · ASRᵢ",
      ref: "paper §4",
      blurb: "Whether the chosen attacks actually succeed against the target.",
      detail:
        "Per-family ASR transfers cleanly across observation and forced-injection settings (ρ = +0.702, p = 1.38×10⁻⁸); capability is a stable per-family property of the agent.",
    },
    {
      key: "momentum",
      tone: "injection" as const,
      title: "Bias momentum",
      metrics: "Compliance · ΔASR",
      ref: "paper §5–§6",
      blurb: "How free-choice preferences resist forced redirection.",
      detail:
        "Compliance with explicit user steering tracks an agent's free-choice preferences (ρ = +0.529), not its per-family capabilities (ρ = -0.248). All five agents show ΔASR ≤ 0 — forced redistribution does not raise outcomes.",
    },
  ];

  return (
    <section id="findings-synthesis" className="scroll-mt-24 rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Synthesis
        </p>
        <h3 className="font-serif text-2xl text-foreground mt-1">
          Three separable behavioral axes
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Allocation, attack performance, and bias momentum each decouple from the others —
          they must be measured independently.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(({ key, ...col }) => (
          <SynthesisColumn key={key} {...col} />
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
}: {
  tone: "bias" | "performance" | "injection";
  title: string;
  metrics: string;
  ref: string;
  blurb: string;
  detail: string;
}) {
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span>{open ? "Hide" : "Read more"}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/60">
          {detail}
        </p>
      )}
    </div>
  );
}

function AxisLegend({
  tone,
  title,
  metrics,
  question,
  layer,
  href,
}: {
  tone: "bias" | "performance" | "efficiency" | "injection";
  title: string;
  metrics: string;
  question: string;
  layer: string;
  href: string;
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
    <a
      href={href}
      className="block rounded-md p-2 -m-2 space-y-1.5 transition-colors hover:bg-muted/40 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${label}`}>{title}</span>
        <span className="text-xs font-mono text-muted-foreground">{metrics}</span>
      </div>
      <p className="text-xs italic text-muted-foreground">{question}</p>
      <p className="text-[11px] font-mono text-muted-foreground/70">{layer}</p>
    </a>
  );
}
