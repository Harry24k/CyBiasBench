"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";
import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { InjectionDesignDiagram } from "@/components/charts/injection-design";
import { useChartColors, useAgentColors } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";
import type { PaperSummary, CompliancePredictor } from "@/lib/types";

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
    const [m, e] = exp.split("e");
    return `${m}\u00D7\u200910${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

export function Layer3Injection({ data }: { data: PaperSummary }) {
  const agents = data.agents;
  const t4 = data.table4_compliance;
  const predictors = data.fig5_compliance_predictors;
  const h = data.headline_stats;
  const agentColors = useAgentColors();

  const deltaBars = agents.map((a) => ({
    agent: a,
    label: AGENT_LABELS[a] ?? a,
    delta: (t4[a]?.delta_asr ?? 0) * 100,
    color: agentColors[a] ?? "#888",
  }));

  return (
    <div className="space-y-14">
      <header className="max-w-[1500px] mx-auto px-6">
        <div className="flex items-baseline gap-4">
          <span className="text-xs font-mono text-rose-500 tracking-widest uppercase">
            Layer 3
          </span>
          <h2 className="font-serif text-3xl text-foreground">
            Bias Injection
          </h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl">
          Forcing a target family redirects selection but does not reshape preference. Compliance
          tracks what agents already liked to pick (ρ = +{h.compliance_sel.rho.toFixed(3)},
          p = {formatP(h.compliance_sel.p)}), not what they were capable of
          (ρ = {h.compliance_asri.rho.toFixed(3)}, p = {formatP(h.compliance_asri.p)}).
          And per-family ASR transfers from free choice to forced injection
          (ρ = +{h.asr_transfer.rho.toFixed(3)}, p = {formatP(h.asr_transfer.p)}).
          Allocation can be steered while capability does not budge — a decoupling we term
          {" "}<strong className="text-foreground">bias momentum</strong>.
        </p>
      </header>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Bias Injection design
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Forced-family condition. The environment, tool access, and verification pipeline
              remain identical to Bias Observation; only the task focus statement names a
              target family.
            </p>
          </div>
          <InjectionDesignDiagram />
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              ΔASR across all five agents
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Difference between observation (S1) and forced-injection (S2) session ASR. All five
              agents lie at or below zero — forcing never raises outcomes.
            </p>
          </div>
          <DeltaAsrBars bars={deltaBars} />
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Compliance predictors
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Each point is one (agent, family) cell under forced injection. Compliance follows
              Sel<sub>i</sub> (S1 preference) but is decoupled from ASR<sub>i</sub> (S1 capability).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PredictorPanel
              title="Selᵢ (S1) vs Compliance"
              xKey="sel_i"
              xLabel="Selection rate Selᵢ"
              data={predictors}
              rho={h.compliance_sel.rho}
              pValue={h.compliance_sel.p}
              xFormat={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <PredictorPanel
              title="ASRᵢ (S1) vs Compliance"
              xKey="asr_i"
              xLabel="Per-family ASRᵢ"
              data={predictors}
              rho={h.compliance_asri.rho}
              pValue={h.compliance_asri.p}
              xFormat={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Per-family ASR transfer
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              S1 per-family ASR<sub>i</sub> vs S2 per-family ASR<sub>i</sub> under forced
              injection. The strong positive correlation
              (ρ = +{h.asr_transfer.rho.toFixed(3)}, p = {formatP(h.asr_transfer.p)})
              confirms capability persists across prompt conditions and forcing.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <AsrTransferPanel
              data={predictors}
              rho={h.asr_transfer.rho}
              pValue={h.asr_transfer.p}
            />
            <GeminiExceptionCallout />
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-6 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-rose-400">
                Synthesis · paper §5–7
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Three separable axes
              </span>
            </div>
            <h3 className="font-serif text-2xl text-foreground">
              Allocation, attack performance, and bias momentum are distinct axes.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Across five frontier agents, three target environments, and 630
              total sessions, attack-selection bias is{" "}
              <strong className="text-foreground">stable, agent-specific, and prompt-invariant</strong>:
              behavioral heterogeneity ({" "}
              <span className="font-mono">η²<sub>H(X)</sub> = {h.kruskal_H.eta2.toFixed(3)}</span>,{" "}
              {formatP(h.kruskal_H.p)}) outpaces outcome heterogeneity (η²<sub>ASR</sub> = {h.kruskal_session_asr.eta2.toFixed(3)}) by an order of magnitude.
              Under forced injection, compliance follows free-choice selection
              (ρ = +{h.compliance_sel.rho.toFixed(3)},{" "}
              {formatP(h.compliance_sel.p)}), <em>not</em> per-family capability
              ({" "}<span className="font-mono">ρ = {h.compliance_asri.rho.toFixed(3)}</span>, n.s.) — preferences
              carry over even when overridden, a phenomenon we term{" "}
              <strong className="text-foreground">bias momentum</strong>. Per-family ASR itself transfers
              cleanly across settings (ρ = +{h.asr_transfer.rho.toFixed(3)},{" "}
              {formatP(h.asr_transfer.p)}), confirming that the bias lives in
              allocation, not capability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-rose-500/20">
              <Takeaway
                tag="What stays"
                body="Per-family capability transfers; what an agent does well, it keeps doing well across regimes."
              />
              <Takeaway
                tag="What doesn't"
                body="Allocation does not adapt to capability — agents keep routing attempts to families they already prefer, regardless of outcome."
              />
              <Takeaway
                tag="What that means for evaluation"
                body="Outcome-only benchmarks compress distinct strategies into one number. Allocation, attack performance, and bias momentum must be measured as separable axes."
              />
            </div>
          </div>
        </section>
      </FadeIn>

      <div className="max-w-[1500px] mx-auto px-6">
        <BridgeText>
          Forcing redistributes actions but not preferences. Bias persists as momentum.
        </BridgeText>
      </div>
    </div>
  );
}

function Takeaway({ tag, body }: { tag: string; body: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-mono uppercase tracking-widest text-rose-400/80">
        {tag}
      </span>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function DeltaAsrBars({
  bars,
}: {
  bars: { agent: string; label: string; delta: number; color: string }[];
}) {
  const colors = useChartColors();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={bars}
          margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: colors.tick }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.tick }}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}pp`}
            domain={[-20, 5]}
            label={{
              value: "Δ session ASR (pp)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <Tooltip
            formatter={(v) =>
              `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)} pp`
            }
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
          />
          <ReferenceLine y={0} stroke={colors.tick} strokeWidth={1} />
          <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
            {bars.map((b) => (
              <Cell key={b.agent} fill={b.color} fillOpacity={0.85} />
            ))}
            <LabelList
              dataKey="delta"
              position="top"
              formatter={(v) => `${Number(v).toFixed(1)}pp`}
              style={{ fontSize: 12, fill: colors.tick }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 justify-center text-xs text-muted-foreground">
        {bars.map((b) => (
          <span
            key={b.agent}
            className="flex items-center gap-1.5 font-mono tabular-nums"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            {b.label} {b.delta >= 0 ? "+" : ""}
            {b.delta.toFixed(2)}pp
          </span>
        ))}
      </div>
    </div>
  );
}

function PredictorPanel({
  title,
  xKey,
  xLabel,
  data,
  rho,
  pValue,
  xFormat,
}: {
  title: string;
  xKey: "sel_i" | "asr_i";
  xLabel: string;
  data: CompliancePredictor[];
  rho: number;
  pValue: number;
  xFormat: (v: number) => string;
}) {
  const colors = useChartColors();
  const agentColors = useAgentColors();
  const byAgent = new Map<string, CompliancePredictor[]>();
  for (const p of data) {
    if (!byAgent.has(p.agent)) byAgent.set(p.agent, []);
    byAgent.get(p.agent)!.push(p);
  }
  const agents = Array.from(byAgent.keys());

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">
          ρ = {rho >= 0 ? "+" : ""}
          {rho.toFixed(3)} · p = {formatP(pValue)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey={xKey}
            domain={[0, "dataMax"]}
            tickFormatter={(v) => xFormat(Number(v))}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -8,
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <YAxis
            type="number"
            dataKey="compliance"
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "Compliance (S2)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <ZAxis range={[45, 45]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: colors.grid }}
            formatter={(v, name) => {
              const n = Number(v);
              if (name === "compliance") return `${(n * 100).toFixed(1)}%`;
              if (xKey === "sel_i" || xKey === "asr_i") return `${(n * 100).toFixed(1)}%`;
              return n.toFixed(3);
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
          />
          {agents.map((a) => (
            <Scatter
              key={a}
              name={AGENT_LABELS[a] ?? a}
              data={byAgent.get(a)}
              fill={agentColors[a] ?? "#888"}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function GeminiExceptionCallout() {
  return (
    <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-5 space-y-3 self-start">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
          Gemini exception
        </span>
      </div>
      <p className="text-sm text-foreground font-semibold leading-snug">
        Cross-setting transfer is significant for 4 of 5 agents — Gemini is the lone outlier.
      </p>
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          Aggregate: <span className="font-mono text-foreground">ρ = +0.696</span>{" "}
          <span className="font-mono">(p = 1.96×10⁻⁸, n = 50)</span>.{" "}
          Per-agent (n=10):
        </p>
        <ul className="space-y-1 font-mono">
          <li>· Claude / Codex / GLM / Kimi: significant at p &lt; 0.05</li>
          <li>· Gemini: <span className="text-foreground">ρ = +0.122, n.s.</span></li>
        </ul>
        <p className="pt-2 border-t border-border/60">
          Yet within Gemini, compliance correlates with target-restricted ASR
          (<span className="font-mono text-foreground">ρ = +0.696, p = 0.025</span>).
          Its highly concentrated free-choice profile means steering happens to
          align with where it's already capable — preference and ability are
          partially fused only for the most peaked allocator.
        </p>
      </div>
    </div>
  );
}

function AsrTransferPanel({
  data,
  rho,
  pValue,
}: {
  data: CompliancePredictor[];
  rho: number;
  pValue: number;
}) {
  const colors = useChartColors();
  const agentColors = useAgentColors();
  const byAgent = new Map<string, CompliancePredictor[]>();
  for (const p of data) {
    if (!byAgent.has(p.agent)) byAgent.set(p.agent, []);
    byAgent.get(p.agent)!.push(p);
  }
  const agents = Array.from(byAgent.keys());

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">
          S1 ASR<sub>i</sub> vs S2 ASR<sub>i</sub>
        </p>
        <span className="text-xs font-mono tabular-nums text-foreground">
          ρ = +{rho.toFixed(3)} · p = {formatP(pValue)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey="asr_i"
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "S1 per-family ASRᵢ (observation)",
              position: "insideBottom",
              offset: -15,
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <YAxis
            type="number"
            dataKey="asr_i_s2"
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "S2 per-family ASRᵢ (forced)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <ZAxis range={[55, 55]} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            stroke={colors.tick}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: colors.grid }}
            formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
            labelFormatter={() => ""}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
          />
          {agents.map((a) => (
            <Scatter
              key={a}
              name={AGENT_LABELS[a] ?? a}
              data={byAgent.get(a)}
              fill={agentColors[a] ?? "#888"}
              fillOpacity={0.75}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground justify-center">
        {agents.map((a) => (
          <span key={a} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: agentColors[a] ?? "#888" }}
            />
            {AGENT_LABELS[a] ?? a}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-2">
          <span className="inline-block w-4 border-t border-dashed border-muted-foreground" />
          y = x
        </span>
      </div>
    </div>
  );
}

