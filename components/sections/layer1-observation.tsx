"use client";

import { useState } from "react";
import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { ConditionHeatmapGrid } from "@/components/charts/condition-heatmap-grid";
import { MiniFamilyBars } from "@/components/charts/mini-radar";
import { AGENT_LABELS } from "@/lib/types";
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

  const tpsMap = (data.tps_per_agent ?? {}) as Record<string, number | null>;
  const maxH = Math.max(...agents.map((a) => sig[a]?.entropy ?? 0));
  const maxUniq = Math.max(...agents.map((a) => sig[a]?.unique_techniques ?? 0));
  const maxTps = Math.max(...agents.map((a) => tpsMap[a] ?? 0));

  return (
    <div className="space-y-14">
      <header className="max-w-[1500px] mx-auto px-6">
        <div className="flex items-baseline gap-4">
          <span className="text-xs font-mono text-indigo-500 tracking-widest uppercase">
            Layer 1
          </span>
          <h2 className="font-serif text-3xl text-foreground">Bias Observation</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl">
          Under free choice, each agent exposes a distinctive allocation profile over the 10 attack
          families. Kruskal–Wallis across H(X) rejects a shared distribution
          (H = {kw.H.toFixed(2)}, p = {formatP(kw.p)}, η² = {kw.eta2.toFixed(3)}), and
          prompt variation contributes less than between-agent variation (see JSD).
        </p>
      </header>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">Agent Signatures</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Three bias indicators per agent: attack-family entropy H(X), mean unique families per
              session, and dominant-family share. Hover any row to see that agent&apos;s full
              Sel<sub>i</sub> distribution across all 10 families.
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[170px_1fr_1fr_1fr_1fr] text-sm">
              <div className="bg-muted/50 px-5 py-3 font-semibold text-foreground">Agent</div>
              <div className="bg-muted/50 px-5 py-3 font-semibold text-foreground text-right">
                H(X) <span className="text-xs text-muted-foreground font-normal">↑ breadth</span>
              </div>
              <div className="bg-muted/50 px-5 py-3 font-semibold text-foreground text-right">
                Unique / session{" "}
                <span className="text-xs text-muted-foreground font-normal">↑ breadth</span>
              </div>
              <div className="bg-muted/50 px-5 py-3 font-semibold text-foreground text-right">
                Most Selected Family{" "}
                <span className="text-xs text-muted-foreground font-normal">Sel<sub>i</sub></span>
              </div>
              <div className="bg-muted/50 px-5 py-3 font-semibold text-foreground text-right">
                TPS{" "}
                <span className="text-xs text-muted-foreground font-normal">↓ efficient</span>
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
                    tps={tpsMap[a] ?? null}
                    maxH={maxH}
                    maxUniq={maxUniq}
                    maxTps={maxTps}
                    selByFamily={data.fig3_selection_per_agent[a] ?? {}}
                    families={families}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </FadeIn>

      {data.fig2_selection_heatmap_by_condition && (
        <FadeIn>
          <section className="max-w-[1500px] mx-auto px-6">
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
        <section className="max-w-[1500px] mx-auto px-6">
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
          <section className="max-w-[1500px] mx-auto px-6">
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

      <div className="max-w-[1500px] mx-auto px-6">
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
  tps,
  maxH,
  maxUniq,
  maxTps,
  selByFamily,
  families,
}: {
  agent: string;
  color: string;
  entropy: number;
  unique: number;
  topShare: number;
  topFamily: string;
  tps: number | null;
  maxH: number;
  maxUniq: number;
  maxTps: number;
  selByFamily: Record<string, number>;
  families: string[];
}) {
  const [hover, setHover] = useState(false);
  return (
    <>
      <div
        className="relative px-5 py-4 border-t border-border flex items-center gap-2"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-foreground">
          {AGENT_LABELS[agent] ?? agent}
        </span>
        {hover && (
          <div
            className="absolute z-50 left-0 top-full mt-2 bg-card border border-border rounded-md p-3 shadow-lg w-[300px] pointer-events-none"
            role="tooltip"
          >
            <div className="text-xs font-semibold text-foreground mb-2">
              {AGENT_LABELS[agent] ?? agent} · Sel<sub>i</sub> by family
            </div>
            <MiniFamilyBars
              selByFamily={selByFamily}
              families={families}
              familyLabels={FAMILY_LABELS}
              color={color}
              height={180}
              highlightFamily={topFamily}
            />
          </div>
        )}
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
        value={topShare}
        max={100}
        color={color}
        format={(v) => `${v.toFixed(1)}%`}
        onHover={setHover}
        suffix={
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {FAMILY_LABELS[topFamily] ?? topFamily}
          </span>
        }
      />
      {tps != null ? (
        <BarCell
          value={tps}
          max={maxTps}
          color={color}
          format={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
          }
          onHover={setHover}
          suffix={
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              tok/✓
            </span>
          }
        />
      ) : (
        <div
          className="px-5 py-4 border-t border-border text-right text-muted-foreground"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          —
        </div>
      )}
    </>
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
    target_breakdown?: Array<{
      target: string;
      within_prompt: number | null;
      between_agent: number | null;
      ratio: number | null;
    }>;
  };
}) {
  const isLight = useTheme();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const withinMean = jsd.centroid_within_mean;
  const ratio = jsd.between_agent_mean / withinMean;
  const maxVal = Math.max(withinMean, jsd.between_agent_mean);
  const withinColor = isLight ? "#64748b" : "#94a3b8";
  const betweenColor = isLight ? "#4f46e5" : "#6366f1";

  const breakdown = jsd.target_breakdown ?? [];
  const hasBreakdown = breakdown.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
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
            <span className="text-3xl font-mono font-bold text-foreground tabular-nums">
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

        {/* Center divider with ratio */}
        <div className="flex flex-col items-center justify-center px-2">
          <div className="h-full w-px bg-border" />
          <div className="my-3 px-3 py-1.5 rounded-full bg-muted text-center">
            <span className="text-lg font-mono font-bold text-foreground tabular-nums">
              {ratio.toFixed(2)}×
            </span>
          </div>
          <div className="h-full w-px bg-border" />
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
            <span className="text-3xl font-mono font-bold text-foreground tabular-nums">
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

      {hasBreakdown && (
        <div className="mt-6 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            aria-expanded={showBreakdown}
          >
            {showBreakdown ? "Hide" : "Show"} per-target breakdown
          </button>

          {showBreakdown && (
            <TargetBreakdown
              rows={breakdown}
              withinColor={withinColor}
              betweenColor={betweenColor}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TargetBreakdown({
  rows,
  withinColor,
  betweenColor,
}: {
  rows: Array<{
    target: string;
    within_prompt: number | null;
    between_agent: number | null;
    ratio: number | null;
  }>;
  withinColor: string;
  betweenColor: string;
}) {
  const targetLabels: Record<string, string> = {
    "juice-shop": "Juice Shop",
    mlflow: "MLflow",
    "vuln-shop": "Vuln Shop",
  };
  const maxV = Math.max(
    0.001,
    ...rows.flatMap((r) => [r.within_prompt ?? 0, r.between_agent ?? 0]),
  );

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        JSD decomposed per target. Within-prompt = same prompt across agents;
        between-agent = same agent across prompts. Ratio &gt; 1 means
        between-agent separation dominates.
      </p>
      <div className="space-y-3">
        {rows.map((r) => {
          const wp = r.within_prompt ?? 0;
          const ba = r.between_agent ?? 0;
          const wpPct = (wp / maxV) * 100;
          const baPct = (ba / maxV) * 100;
          return (
            <div
              key={r.target}
              className="grid grid-cols-[120px_1fr_72px] gap-3 items-center text-xs"
            >
              <div className="font-medium text-foreground">
                {targetLabels[r.target] ?? r.target}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: withinColor }}
                  />
                  <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${wpPct}%`,
                        backgroundColor: withinColor,
                      }}
                    />
                  </div>
                  <span className="font-mono tabular-nums w-14 text-right text-foreground">
                    {wp.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: betweenColor }}
                  />
                  <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${baPct}%`,
                        backgroundColor: betweenColor,
                      }}
                    />
                  </div>
                  <span className="font-mono tabular-nums w-14 text-right text-foreground">
                    {ba.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className="inline-block font-mono tabular-nums text-sm font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    color:
                      (r.ratio ?? 0) >= 1
                        ? "#16a34a"
                        : "var(--muted-foreground, #71717a)",
                    backgroundColor: "var(--muted, #f1f5f9)",
                  }}
                >
                  {r.ratio != null ? `${r.ratio.toFixed(2)}×` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: withinColor }}
          />
          within-prompt
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: betweenColor }}
          />
          between-agent
        </span>
      </div>
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
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Headline accuracy */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-indigo-500">
            Leave-one-session-out
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-mono font-bold text-foreground tabular-nums">
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
