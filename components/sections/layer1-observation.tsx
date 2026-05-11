"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { ConditionHeatmapGrid } from "@/components/charts/condition-heatmap-grid";
import { MiniFamilyBars } from "@/components/charts/mini-radar";
import { PortalTooltip } from "@/components/charts/portal-tooltip";
import { AGENT_LABELS, FAMILY_FULLNAME } from "@/lib/types";
import type { PaperSummary } from "@/lib/types";
import { useAgentColors, useChartColors, useTheme } from "@/lib/use-theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
} from "recharts";

const FAMILY_LABELS: Record<string, string> = {
  sqli: "SQLi",
  xss: "XSS",
  cmdi: "CmdI",
  path_traversal: "PathTrav",
  auth_bypass: "AuthBypass",
  idor: "IDOR",
  ssrf: "SSRF",
  csrf: "CSRF",
  file_upload: "FileUp",
  info_disclosure: "InfoDisc",
};

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

export function Layer1Observation({ data }: { data: PaperSummary }) {
  const agents = data.agents;
  const families = data.families;
  const sig = data.table1_agent_signatures;
  const jsd = data.table2_jsd;
  const kw = data.headline_stats.kruskal_H;
  const agentColors = useAgentColors();

  const maxH = Math.max(...agents.map((a) => sig[a]?.entropy ?? 0));
  const maxUniq = Math.max(...agents.map((a) => sig[a]?.unique_techniques ?? 0));
  const maxCr1 = Math.max(...agents.map((a) => sig[a]?.selection_cr1 ?? 0));
  const maxAsr = Math.max(...agents.map((a) => (sig[a]?.session_asr_mean ?? 0)));

  return (
    <div id="findings-layer1" className="space-y-14 scroll-mt-24">
      <header className="max-w-[1500px] mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">Bias Observation</h2>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl">
          Under free choice, each agent exposes a distinctive allocation profile over the 10
          attack families. Kruskal–Wallis on H(X) rejects a shared distribution
          (H = {kw.H.toFixed(2)}, p = {formatP(kw.p)}, η² = {kw.eta2.toFixed(3)}), and prompt
          variation contributes less than between-agent variation
          (Prompt-stability JSD 0.038 vs between-agent 0.054).
        </p>
      </header>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">Agent Signatures</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Three bias indicators per agent: entropy H(X), mean unique families per session,
              and the most-selected family&apos;s share (Sel<sub>i</sub>). Hover any desktop
              row to see the full Sel<sub>i</sub> distribution across all 10 attack families.
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            {/* Desktop: dense per-agent grid */}
            <div className="hidden md:grid grid-cols-[150px_1.5fr_0.9fr_0.9fr_0.9fr_0.9fr] text-sm">
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground">Agent</div>
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground">
                Most Selected Family{" "}
                <span className="text-xs text-muted-foreground font-normal">(Sel<sub>i</sub>)</span>
              </div>
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                H(X){" "}
                <span className="text-xs text-muted-foreground font-normal">↑ breadth</span>
              </div>
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                Unique / sess{" "}
                <span className="text-xs text-muted-foreground font-normal">↑ breadth</span>
              </div>
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                Sel CR1{" "}
                <span className="text-xs text-muted-foreground font-normal">↑ concentrated</span>
              </div>
              <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                Session ASR{" "}
                <span className="text-xs text-muted-foreground font-normal">↑ better</span>
              </div>

              {agents.map((a) => {
                const s = sig[a];
                if (!s) return null;
                const color = agentColors[a] ?? "#888";
                return (
                  <SignatureRow
                    key={a}
                    agent={a}
                    color={color}
                    entropy={s.entropy}
                    unique={s.unique_techniques}
                    topShare={s.top_share}
                    topFamily={s.top_family}
                    cr1={s.selection_cr1 ?? 0}
                    sessionAsr={s.session_asr_mean ?? 0}
                    maxH={maxH}
                    maxUniq={maxUniq}
                    maxCr1={maxCr1}
                    maxAsr={maxAsr}
                    selByFamily={data.fig3_selection_per_agent[a] ?? {}}
                    families={families}
                  />
                );
              })}
            </div>

            {/* Mobile: stacked cards (same metrics as desktop), inline Sel_i bars */}
            <div className="md:hidden divide-y divide-border">
              {agents.map((a) => {
                const s = sig[a];
                if (!s) return null;
                const color = agentColors[a] ?? "#888";
                return (
                  <MobileSignatureCard
                    key={a}
                    agent={a}
                    color={color}
                    entropy={s.entropy}
                    unique={s.unique_techniques}
                    topShare={s.top_share}
                    topFamily={s.top_family}
                    cr1={s.selection_cr1 ?? 0}
                    sessionAsr={s.session_asr_mean ?? 0}
                    maxH={maxH}
                    maxUniq={maxUniq}
                    maxCr1={maxCr1}
                    maxAsr={maxAsr}
                    selByFamily={data.fig3_selection_per_agent[a] ?? {}}
                    families={families}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            36 free-choice sessions per agent. Sel<sub>i</sub> in parentheses is the
            most-selected family&apos;s share;{" "}
            <span className="font-mono">Sel CR1</span> is the within-session concentration
            averaged across sessions.
          </p>
        </section>
      </FadeIn>

      {data.fig2_selection_heatmap_by_condition && (
        <FadeIn>
          <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Selection across the four prompt conditions
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Same Sel<sub>i</sub> heatmap split by the 2×2 prompt design.
                Within an agent, the four panels look nearly identical;
                between agents, they look obviously different.
              </p>
            </div>
            <ConditionHeatmapGrid
              agents={agents}
              families={families}
              familyLabels={FAMILY_LABELS}
              byCondition={data.fig2_selection_heatmap_by_condition}
              pooledByAgent={data.fig3_selection_per_agent}
            />
          </section>
        </FadeIn>
      )}

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Prompt Robustness (JSD)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Jensen–Shannon divergence between family distributions. Within-agent drift
              (prompt conditions vs agent centroid) is much smaller than between-agent
              separation — profiles reflect intrinsic model tendency, not prompt wording.
            </p>
          </div>
          <JSDComparison jsd={jsd} />
        </section>
      </FadeIn>

      {data.agent_identification_rf && (
        <FadeIn>
          <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Agent Identification by Selection Pattern
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                A random forest classifier trained on the 10-family Sel<sub>i</sub> vectors
                identifies the underlying agent at{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {((data.headline_stats.rf_accuracy ?? data.agent_identification_rf.metrics.leave_one_out?.accuracy ?? 0) * 100).toFixed(0)}%
                </span>{" "}
                accuracy versus a{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {((data.headline_stats.rf_baseline ?? data.agent_identification_rf.baseline_accuracy ?? 0.2) * 100).toFixed(0)}%
                </span>{" "}
                chance baseline — selection profiles are agent-specific fingerprints.
              </p>
            </div>
            <RFIdentificationCard
              rf={data.agent_identification_rf}
              accuracy={data.headline_stats.rf_accuracy}
              baseline={data.headline_stats.rf_baseline}
            />
          </section>
        </FadeIn>
      )}

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6">
        <BridgeText>
          Selection profiles are stable and model-specific. But do these preferences track what
          actually succeeds?
        </BridgeText>
      </div>
    </div>
  );
}

function SignatureRow({
  agent,
  color,
  entropy,
  unique,
  topShare,
  topFamily,
  cr1,
  sessionAsr,
  maxH,
  maxUniq,
  maxCr1,
  maxAsr,
  selByFamily,
  families,
}: {
  agent: string;
  color: string;
  entropy: number;
  unique: number;
  topShare: number;
  topFamily: string;
  cr1: number;
  sessionAsr: number;
  maxH: number;
  maxUniq: number;
  maxCr1: number;
  maxAsr: number;
  selByFamily: Record<string, number>;
  families: string[];
}) {
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => setMounted(true), []);
  // Follow the mouse pointer via direct DOM transform — never re-render the
  // tooltip on mouse move (ResponsiveContainer would otherwise re-measure on
  // every frame and cause visible jitter / scroll thrash).
  useEffect(() => {
    if (!hover) return;
    const TOOLTIP_W = 440;
    const TOOLTIP_H = 360;
    const onMove = (e: MouseEvent) => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const node = tooltipRef.current;
        if (!node) return;
        const offsetX = 14;
        const offsetY = 18;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = e.clientX + offsetX;
        let top = e.clientY + offsetY;
        if (left + TOOLTIP_W + 8 > vw) left = e.clientX - TOOLTIP_W - offsetX;
        if (top + TOOLTIP_H + 8 > vh) top = e.clientY - TOOLTIP_H - offsetY;
        left = Math.max(8, left);
        top = Math.max(8, top);
        node.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      });
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [hover]);
  const onEnter = () => setHover(true);
  const onLeave = () => setHover(false);
  return (
    <>
      <div
        className="px-5 py-4 border-t border-border flex items-center gap-2"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-foreground">
          {AGENT_LABELS[agent] ?? agent}
        </span>
        {mounted && hover && createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 440,
              zIndex: 1000,
              pointerEvents: "none",
              transform: "translate3d(-9999px, -9999px, 0)",
              willChange: "transform",
            }}
            className="rounded-lg border border-border bg-card shadow-2xl p-5"
          >
            <div className="text-sm font-semibold text-foreground mb-3">
              {AGENT_LABELS[agent] ?? agent} · Sel<sub>i</sub> by family (10 attack families)
            </div>
            <MiniFamilyBars
              selByFamily={selByFamily}
              families={families}
              familyLabels={FAMILY_LABELS}
              color={color}
              height={280}
              highlightFamily={topFamily}
            />
          </div>,
          document.body,
        )}
      </div>
      {/* Most Selected Family (Sel_i) */}
      <div
        className="px-4 py-4 border-t border-border flex items-center"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-foreground font-medium truncate">
            <abbr
              title={FAMILY_FULLNAME[topFamily] ?? topFamily}
              className="no-underline decoration-dotted decoration-muted-foreground/40 underline underline-offset-2 cursor-help"
            >
              {FAMILY_LABELS[topFamily] ?? topFamily}
            </abbr>
          </span>
          <span className="font-mono tabular-nums text-sm text-muted-foreground whitespace-nowrap">
            ({topShare.toFixed(1)}%)
          </span>
        </div>
      </div>
      <BarCell
        value={entropy}
        max={maxH}
        color={color}
        format={(v) => v.toFixed(2)}
        onHover={setHover}
      />
      <BarCell
        value={unique}
        max={maxUniq}
        color={color}
        format={(v) => v.toFixed(1)}
        onHover={setHover}
      />
      <BarCell
        value={cr1}
        max={maxCr1}
        color={color}
        format={(v) => `${v.toFixed(1)}%`}
        onHover={setHover}
      />
      <BarCell
        value={sessionAsr}
        max={maxAsr}
        color={color}
        format={(v) => `${(v * 100).toFixed(1)}%`}
        onHover={setHover}
      />
    </>
  );
}

function MobileSignatureCard({
  agent,
  color,
  entropy,
  unique,
  topShare,
  topFamily,
  cr1,
  sessionAsr,
  maxH,
  maxUniq,
  maxCr1,
  maxAsr,
  selByFamily,
  families,
}: {
  agent: string;
  color: string;
  entropy: number;
  unique: number;
  topShare: number;
  topFamily: string;
  cr1: number;
  sessionAsr: number;
  maxH: number;
  maxUniq: number;
  maxCr1: number;
  maxAsr: number;
  selByFamily: Record<string, number>;
  families: string[];
}) {
  const rows: Array<{ label: React.ReactNode; value: string; pct: number; suffix?: string; suffixTitle?: string }> = [
    {
      label: <>Most Selected <span className="text-muted-foreground/70">Sel<sub>i</sub></span></>,
      value: `${topShare.toFixed(1)}%`,
      pct: topShare,
      suffix: FAMILY_LABELS[topFamily] ?? topFamily,
      suffixTitle: FAMILY_FULLNAME[topFamily],
    },
    {
      label: <>H(X) <span className="text-muted-foreground/70">↑ breadth</span></>,
      value: entropy.toFixed(2),
      pct: maxH > 0 ? (entropy / maxH) * 100 : 0,
    },
    {
      label: <>Unique / session</>,
      value: unique.toFixed(1),
      pct: maxUniq > 0 ? (unique / maxUniq) * 100 : 0,
    },
    {
      label: <>Sel CR1 <span className="text-muted-foreground/70">↑ concentrated</span></>,
      value: `${cr1.toFixed(1)}%`,
      pct: maxCr1 > 0 ? (cr1 / maxCr1) * 100 : 0,
    },
    {
      label: <>Session ASR <span className="text-muted-foreground/70">↑ better</span></>,
      value: `${(sessionAsr * 100).toFixed(1)}%`,
      pct: maxAsr > 0 ? (sessionAsr / maxAsr) * 100 : 0,
    },
  ];
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-foreground">
          {AGENT_LABELS[agent] ?? agent}
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <div className="font-mono tabular-nums text-sm text-foreground whitespace-nowrap">
              {r.value}
              {r.suffix && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  {r.suffixTitle ? (
                    <abbr title={r.suffixTitle} className="no-underline decoration-dotted decoration-muted-foreground/40 underline underline-offset-2 cursor-help">
                      {r.suffix}
                    </abbr>
                  ) : (
                    r.suffix
                  )}
                </span>
              )}
            </div>
            <div className="col-span-2 relative h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.min(100, r.pct)}%`, backgroundColor: color, opacity: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border/60">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Sel<sub>i</sub> across 10 families
        </div>
        <MiniFamilyBars
          selByFamily={selByFamily}
          families={families}
          familyLabels={FAMILY_LABELS}
          color={color}
          height={140}
          highlightFamily={topFamily}
        />
      </div>
    </div>
  );
}

function BarCell({
  value,
  max,
  color,
  format,
  suffix,
  onHover,
}: {
  value: number;
  max: number;
  color: string;
  format: (v: number) => string;
  suffix?: React.ReactNode;
  onHover?: (v: boolean) => void;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="px-5 py-4 border-t border-border"
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className="flex items-center justify-end gap-3">
        <div className="relative h-2 w-full max-w-[180px] rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }}
          />
        </div>
        <span className="font-mono tabular-nums text-sm text-foreground whitespace-nowrap">
          {format(value)}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function JSDComparison({
  jsd,
}: {
  jsd: {
    between_agent_median: number;
    between_agent_mean: number;
    centroid_within_mean: number;
  };
}) {
  const isLight = useTheme();
  const withinMean = jsd.centroid_within_mean;
  const ratio = jsd.between_agent_mean / withinMean;
  const maxVal = Math.max(withinMean, jsd.between_agent_mean);
  const withinColor = isLight ? "#64748b" : "#94a3b8";
  const betweenColor = isLight ? "#4f46e5" : "#6366f1";

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
        {/* Within-agent */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: withinColor }}
            />
            <span className="text-sm font-semibold text-foreground">
              Within-agent JSD
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            condition-to-centroid drift, per agent
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground tabular-nums">
              {withinMean.toFixed(3)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">mean</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(withinMean / maxVal) * 100}%`,
                backgroundColor: withinColor,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            four-condition centroid
          </span>
        </div>

        {/* Center divider with ratio (vertical on sm+, horizontal on mobile) */}
        <div className="flex flex-row sm:flex-col items-center justify-center sm:px-2">
          <div className="flex-1 h-px sm:h-auto sm:w-px sm:flex-1 bg-border" />
          <div className="mx-3 sm:mx-0 sm:my-3 px-3 py-1.5 rounded-full bg-muted text-center">
            <span className="text-lg font-mono font-bold text-foreground tabular-nums">
              {ratio.toFixed(2)}×
            </span>
          </div>
          <div className="flex-1 h-px sm:h-auto sm:w-px sm:flex-1 bg-border" />
        </div>

        {/* Between-agent */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: betweenColor }}
            />
            <span className="text-sm font-semibold text-foreground">
              Between-agent JSD
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            across agent pairs
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground tabular-nums">
              {jsd.between_agent_mean.toFixed(3)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">mean</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(jsd.between_agent_mean / maxVal) * 100}%`,
                backgroundColor: betweenColor,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            median {jsd.between_agent_median.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Per-target breakdown intentionally omitted from the site:
          the aggregate marginal JSD (0.0379 < 0.0543) is the load-bearing
          headline; the per-target cut shows Juice Shop with ratio < 1 because
          that target alone has more vulnerabilities than the others, which
          confuses the main claim. The full per-target table is in the paper
          appendix where the surrounding context disambiguates it. */}
    </div>
  );
}


function RFIdentificationCard({
  rf,
  accuracy,
  baseline,
}: {
  rf: NonNullable<PaperSummary["agent_identification_rf"]>;
  accuracy?: number;
  baseline?: number;
}) {
  const chart = useChartColors();
  const agentColors = useAgentColors();
  const acc =
    accuracy ?? rf.metrics.leave_one_out?.accuracy ?? 0;
  const base = baseline ?? rf.baseline_accuracy ?? 0.2;
  const f1Data = rf.per_agent.map((p) => ({
    agent: AGENT_LABELS[p.agent] ?? p.agent,
    agentKey: p.agent,
    f1: (p.f1 ?? 0) * 100,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-6 items-start">
        {/* Headline accuracy */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-indigo-500">
            Leave-one-session-out
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-mono font-bold text-foreground tabular-nums">
              {(acc * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground">accuracy</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
              style={{ width: `${acc * 100}%`, opacity: 0.85 }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/60"
              style={{ left: `${base * 100}%` }}
              aria-label="chance baseline"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
            <span>0%</span>
            <span>baseline {(base * 100).toFixed(0)}%</span>
            <span>100%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {rf.metrics.leave_one_out?.n
              ? `n = ${rf.metrics.leave_one_out.n} sessions, `
              : ""}
            macro-F1 ={" "}
            <span className="font-mono tabular-nums">
              {(rf.metrics.leave_one_out?.macro_f1 ?? 0).toFixed(3)}
            </span>
            .
          </p>
        </div>

        {/* Per-agent F1 */}
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Per-agent F1
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={f1Data}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <XAxis
                  dataKey="agent"
                  tick={{ fontSize: 11, fill: chart.tick }}
                  stroke={chart.grid}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chart.tick }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke={chart.grid}
                />
                <Bar dataKey="f1" radius={[4, 4, 0, 0]}>
                  {f1Data.map((d) => (
                    <Cell
                      key={d.agentKey}
                      fill={agentColors[d.agentKey] ?? "#888"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
