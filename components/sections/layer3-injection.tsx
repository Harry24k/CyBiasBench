"use client";

import { useMemo, useState } from "react";
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
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { InjectionDesignDiagram } from "@/components/charts/injection-design";
import { useChartColors, useAgentColors, useIsMobile } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";
import type { PaperSummary, CompliancePredictor } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    const [m, e] = exp.split("e");
    return `${m}× 10${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

export function Layer3Injection({ data }: { data: PaperSummary }) {
  const agents = data.agents;
  const families = data.families;
  const t4 = data.table4_compliance;
  const predictors = data.fig5_compliance_predictors;
  const h = data.headline_stats;
  const agentColors = useAgentColors();
  // Injection sessions per agent: total injection sessions / num agents (e.g. 450 / 5 = 90)
  const sessionsPerAgent = Math.round(
    (data.n_sessions?.s2 ?? 0) / Math.max(agents.length, 1),
  );

  const obsInjBars = agents.map((a) => ({
    agent: a,
    label: AGENT_LABELS[a] ?? a,
    obs: (t4[a]?.obs_asr ?? 0) * 100,
    inj: (t4[a]?.inj_asr ?? 0) * 100,
    delta: (t4[a]?.delta_asr ?? 0) * 100,
    compliance: (t4[a]?.compliance_mean ?? 0) * 100,
    sessions: sessionsPerAgent,
    color: agentColors[a] ?? "#888",
  }));

  return (
    <div id="findings-layer3" className="space-y-14 scroll-mt-24">
      <header className="max-w-[1500px] mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          Bias Injection
        </h2>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl">
          Explicitly steering an agent toward a requested attack family redirects allocation but
          does not reshape preference. Compliance tracks what agents already liked to pick
          (ρ = +{h.compliance_sel.rho.toFixed(3)}, p = {formatP(h.compliance_sel.p)}), not what
          they were capable of (ρ = {h.compliance_asri.rho.toFixed(3)},
          p = {formatP(h.compliance_asri.p)}). Per-family ASR transfers cleanly across settings
          (ρ = +{h.asr_transfer.rho.toFixed(3)}, p = {formatP(h.asr_transfer.p)}) — capability is
          stable; allocation is what shifts. We call this decoupling{" "}
          <strong className="text-foreground">bias momentum</strong>.
        </p>
      </header>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Bias Injection design
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Requested-family condition. The environment, tool access, and verification pipeline
              remain identical to Bias Observation; only the task focus statement names a
              target family.
            </p>
          </div>
          <InjectionDesignDiagram />
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                Observation vs Injection session ASR per agent
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Side-by-side observation and forced-injection session ASR for each agent.
                Hover for raw obs/inj, ΔASR, compliance, and per-agent injection session count.
              </p>
            </div>
            {h.all_negative_delta_asr && (
              <span className="text-xs font-mono uppercase tracking-widest text-foreground px-2 py-1 rounded border border-foreground/30 bg-muted">
                All 5 agents · ΔASR ≤ 0
              </span>
            )}
          </div>
          <ObsInjBars bars={obsInjBars} />
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              ΔASR per agent
            </h4>
            <DeltaAsrBars
              bars={obsInjBars.map((b) => ({
                agent: b.agent,
                label: b.label,
                delta: b.delta,
                color: b.color,
              }))}
            />
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <CompliancePredictorsSection
          predictors={predictors}
          agents={agents}
          families={families}
          rhoSel={h.compliance_sel.rho}
          pSel={h.compliance_sel.p}
          rhoAsri={h.compliance_asri.rho}
          pAsri={h.compliance_asri.p}
        />
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Per-family ASR transfer (observation → injection)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Observation per-family ASR<sub>i</sub> vs injection per-family ASR<sub>i</sub> under forced
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
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <CorrelationTableToggle h={h} />
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Per-agent injection summary
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Compliance, observed/injected session ASR, and ΔASR by agent. Sorted by ΔASR ascending
              (most damaged first).
            </p>
          </div>
          <PerAgentSummaryTable rows={obsInjBars} />
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="relative rounded-xl border border-border bg-card p-5 sm:p-7 pl-6 sm:pl-8 space-y-5 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 w-1 bg-foreground/70"
              aria-hidden="true"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] font-mono uppercase tracking-widest text-foreground">
                Synthesis · §5–7
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Three separable axes
              </span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-foreground leading-tight">
              Allocation, attack performance, and bias momentum are distinct axes.
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Across five frontier agents, three target environments, and 630
              total sessions, attack-selection bias is{" "}
              <strong className="text-foreground">stable, agent-specific, and prompt-invariant</strong>:
              behavioral heterogeneity (
              <Stat>η²<sub>H(X)</sub> = {h.kruskal_H.eta2.toFixed(3)}</Stat>,{" "}
              <Stat>{formatP(h.kruskal_H.p)}</Stat>) outpaces outcome heterogeneity (
              <Stat>η²<sub>ASR</sub> = {h.kruskal_session_asr.eta2.toFixed(3)}</Stat>) by an order of magnitude.
              Under bias injection, compliance follows free-choice selection
              (<Stat>ρ = +{h.compliance_sel.rho.toFixed(3)}</Stat>,{" "}
              <Stat>{formatP(h.compliance_sel.p)}</Stat>), <em>not</em> per-family capability
              (<Stat>ρ = {h.compliance_asri.rho.toFixed(3)}</Stat>, n.s.) — preferences
              carry over even when overridden, a phenomenon we term{" "}
              <strong className="text-foreground">bias momentum</strong>. Per-family ASR itself transfers
              cleanly across settings (<Stat>ρ = +{h.asr_transfer.rho.toFixed(3)}</Stat>,{" "}
              <Stat>{formatP(h.asr_transfer.p)}</Stat>), confirming that the bias lives in
              allocation, not capability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
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

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6">
        <BridgeText>
          Forcing redistributes actions but not preferences. Bias persists as momentum.
        </BridgeText>
      </div>
    </div>
  );
}

function Takeaway({ tag, body }: { tag: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-foreground/70 leading-none">•</span>
        <span className="text-[11px] font-mono uppercase tracking-widest text-foreground">
          {tag}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-foreground bg-muted/60 rounded px-1 py-0.5 whitespace-nowrap">
      {children}
    </span>
  );
}

type ObsInjBar = {
  agent: string;
  label: string;
  obs: number;
  inj: number;
  delta: number;
  compliance: number;
  sessions: number;
  color: string;
};

function ObsInjBars({ bars }: { bars: ObsInjBar[] }) {
  const colors = useChartColors();
  const isMobile = useIsMobile();
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <BarChart
          data={bars}
          margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: colors.tick }} />
          <YAxis
            tick={{ fontSize: 12, fill: colors.tick }}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            domain={[0, "dataMax+5"]}
            label={{
              value: "Session ASR (%)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <Tooltip
            cursor={{ fill: colors.grid, fillOpacity: 0.15 }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as ObsInjBar | undefined;
              if (!row) return null;
              return (
                <div
                  className="rounded-md border px-3 py-2 text-xs space-y-1"
                  style={{
                    backgroundColor: colors.tooltipBg,
                    borderColor: colors.tooltipBorder,
                    color: colors.tooltipText,
                  }}
                >
                  <div className="font-semibold">{row.label}</div>
                  <div className="font-mono tabular-nums">
                    obs ASR: {row.obs.toFixed(2)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    inj ASR: {row.inj.toFixed(2)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    ΔASR: {row.delta >= 0 ? "+" : ""}
                    {row.delta.toFixed(2)} pp
                  </div>
                  <div className="font-mono tabular-nums">
                    compliance: {row.compliance.toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums text-muted-foreground">
                    Injection sessions: {row.sessions}
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="obs" name="Observation ASR" radius={[4, 4, 0, 0]} fill="#94a3b8">
            {bars.map((b) => (
              <Cell key={`obs-${b.agent}`} fill={b.color} fillOpacity={0.45} />
            ))}
          </Bar>
          <Bar dataKey="inj" name="Injection ASR" radius={[4, 4, 0, 0]} fill="#0f172a">
            {bars.map((b) => (
              <Cell key={`inj-${b.agent}`} fill={b.color} fillOpacity={0.95} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
      <ResponsiveContainer width="100%" height={220}>
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
    </div>
  );
}

// ---- Compliance Predictors with filters & regression toggle ----

function CompliancePredictorsSection({
  predictors,
  agents,
  families,
  rhoSel,
  pSel,
  rhoAsri,
  pAsri,
}: {
  predictors: CompliancePredictor[];
  agents: string[];
  families: string[];
  rhoSel: number;
  pSel: number;
  rhoAsri: number;
  pAsri: number;
}) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    () => new Set(agents),
  );
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    () => new Set(families),
  );
  const [showRegression, setShowRegression] = useState(false);

  const filtered = useMemo(
    () =>
      predictors.filter(
        (p) => selectedAgents.has(p.agent) && selectedFamilies.has(p.family),
      ),
    [predictors, selectedAgents, selectedFamilies],
  );

  function toggleAgent(a: string) {
    setSelectedAgents((s) => {
      const n = new Set(s);
      if (n.has(a)) n.delete(a);
      else n.add(a);
      return n;
    });
  }
  function toggleFamily(f: string) {
    setSelectedFamilies((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }
  function selectAllAgents() {
    setSelectedAgents(new Set(agents));
  }
  function selectAllFamilies() {
    setSelectedFamilies(new Set(families));
  }

  return (
    <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-foreground">
          Compliance predictors
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Each point is one (agent, family) cell under bias injection. Compliance follows
          Selᵢ (free-choice preference) but is decoupled from ASRᵢ (free-choice capability).
          Use the chips to filter agents and families.
        </p>
      </div>

      <FilterChips
        title="Agents"
        items={agents}
        labelMap={AGENT_LABELS}
        selected={selectedAgents}
        onToggle={toggleAgent}
        onAll={selectAllAgents}
      />
      <FilterChips
        title="Families"
        items={families}
        labelMap={FAMILY_LABELS}
        selected={selectedFamilies}
        onToggle={toggleFamily}
        onAll={selectAllFamilies}
      />

      <div className="mt-2 mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showRegression}
            onChange={(e) => setShowRegression(e.target.checked)}
            className="accent-foreground"
          />
          Show regression line (linear fit on filtered points)
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          n = {filtered.length} / {predictors.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PredictorPanel
          title="Selᵢ (observation) vs Compliance"
          xKey="sel_i"
          xLabel="Selection rate Selᵢ"
          data={filtered}
          rho={rhoSel}
          pValue={pSel}
          xFormat={(v) => `${(v * 100).toFixed(0)}%`}
          showRegression={showRegression}
        />
        <PredictorPanel
          title="ASRᵢ (observation) vs Compliance"
          xKey="asr_i"
          xLabel="Per-family ASRᵢ"
          data={filtered}
          rho={rhoAsri}
          pValue={pAsri}
          xFormat={(v) => `${(v * 100).toFixed(0)}%`}
          showRegression={showRegression}
        />
      </div>
    </section>
  );
}

function FilterChips({
  title,
  items,
  labelMap,
  selected,
  onToggle,
  onAll,
}: {
  title: string;
  items: string[];
  labelMap: Record<string, string>;
  selected: Set<string>;
  onToggle: (k: string) => void;
  onAll: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 mb-2 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground sm:w-20">
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {items.map((k) => {
          const active = selected.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onToggle(k)}
              className={
                "text-xs px-2 py-1 rounded-full border transition-colors " +
                (active
                  ? "bg-foreground border-foreground text-background"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/50")
              }
            >
              {labelMap[k] ?? k}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAll}
          className="text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted/50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function linearFit(points: { x: number; y: number }[]): { m: number; b: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  return { m, b };
}

function PredictorPanel({
  title,
  xKey,
  xLabel,
  data,
  rho,
  pValue,
  xFormat,
  showRegression,
}: {
  title: string;
  xKey: "sel_i" | "asr_i";
  xLabel: string;
  data: CompliancePredictor[];
  rho: number;
  pValue: number;
  xFormat: (v: number) => string;
  showRegression: boolean;
}) {
  const colors = useChartColors();
  const agentColors = useAgentColors();
  const isMobile = useIsMobile();
  const byAgent = new Map<string, CompliancePredictor[]>();
  for (const p of data) {
    if (!byAgent.has(p.agent)) byAgent.set(p.agent, []);
    byAgent.get(p.agent)!.push(p);
  }
  const agents = Array.from(byAgent.keys());

  const fit = useMemo(() => {
    if (!showRegression) return null;
    const pts = data.map((d) => ({ x: d[xKey], y: d.compliance }));
    return linearFit(pts);
  }, [data, xKey, showRegression]);

  const xMax = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, d[xKey]);
    return Math.max(m, 0.05);
  }, [data, xKey]);

  const fitLine = useMemo(() => {
    if (!fit) return [] as { x: number; y: number }[];
    const x0 = 0;
    const x1 = xMax;
    return [
      { x: x0, y: Math.max(0, Math.min(1, fit.m * x0 + fit.b)) },
      { x: x1, y: Math.max(0, Math.min(1, fit.m * x1 + fit.b)) },
    ];
  }, [fit, xMax]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">
          ρ = {rho >= 0 ? "+" : ""}
          {rho.toFixed(3)} · p = {formatP(pValue)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
        <ComposedChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, xMax]}
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
            dataKey="y"
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "Compliance (injection)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <ZAxis range={[45, 45]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: colors.grid }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as
                | (CompliancePredictor & { x?: number; y?: number })
                | undefined;
              if (!row || !row.agent) return null;
              return (
                <div
                  className="rounded-md border px-3 py-2 text-xs space-y-1"
                  style={{
                    backgroundColor: colors.tooltipBg,
                    borderColor: colors.tooltipBorder,
                    color: colors.tooltipText,
                  }}
                >
                  <div className="font-semibold">
                    {AGENT_LABELS[row.agent] ?? row.agent} ·{" "}
                    {FAMILY_LABELS[row.family] ?? row.family}
                  </div>
                  <div className="font-mono tabular-nums">
                    Selᵢ: {(row.sel_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    ASRᵢ (obs): {(row.asr_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    target ASR (inj): {(row.asr_i_s2 * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    compliance: {(row.compliance * 100).toFixed(1)}%
                  </div>
                </div>
              );
            }}
          />
          {agents.map((a) => (
            <Scatter
              key={a}
              name={AGENT_LABELS[a] ?? a}
              data={(byAgent.get(a) ?? []).map((d) => ({
                ...d,
                x: d[xKey],
                y: d.compliance,
              }))}
              fill={agentColors[a] ?? "#888"}
              fillOpacity={0.7}
            />
          ))}
          {showRegression && fit && (
            <Line
              data={fitLine}
              dataKey="y"
              type="linear"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          )}
        </ComposedChart>
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
  const isMobile = useIsMobile();
  const byAgent = new Map<string, CompliancePredictor[]>();
  for (const p of data) {
    if (!byAgent.has(p.agent)) byAgent.set(p.agent, []);
    byAgent.get(p.agent)!.push(p);
  }
  const agents = Array.from(byAgent.keys());

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
        <p className="text-sm font-semibold text-foreground">
          Per-family ASR transfer (observation → injection)
        </p>
        <span className="text-xs font-mono tabular-nums text-foreground">
          ρ = +{rho.toFixed(3)} · p = {formatP(pValue)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 260 : 360}>
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey="asr_i"
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "Observation per-family ASRᵢ",
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
              value: "Injection per-family ASRᵢ (forced)",
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
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as CompliancePredictor | undefined;
              if (!row) return null;
              return (
                <div
                  className="rounded-md border px-3 py-2 text-xs space-y-1"
                  style={{
                    backgroundColor: colors.tooltipBg,
                    borderColor: colors.tooltipBorder,
                    color: colors.tooltipText,
                  }}
                >
                  <div className="font-semibold">
                    {AGENT_LABELS[row.agent] ?? row.agent} ·{" "}
                    {FAMILY_LABELS[row.family] ?? row.family}
                  </div>
                  <div className="font-mono tabular-nums">
                    Obs ASRᵢ: {(row.asr_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    Inj ASRᵢ: {(row.asr_i_s2 * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    Selᵢ: {(row.sel_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    compliance: {(row.compliance * 100).toFixed(1)}%
                  </div>
                </div>
              );
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

// ---- Correlation table toggle ----

function CorrelationTableToggle({
  h,
}: {
  h: PaperSummary["headline_stats"];
}) {
  // Compliance → session ASR is reported in the paper Table but is not exposed
  // in headline_stats; values are taken from the published Table.
  const COMPLIANCE_SESSION_ASR = { rho: -0.082, p: 0.573, n: 50 };

  const rows: { label: string; rho: number; p: number; n: number }[] = [
    {
      label: "Sel → compliance",
      rho: h.compliance_sel.rho,
      p: h.compliance_sel.p,
      n: h.compliance_sel.n,
    },
    {
      label: "ASRᵢ → compliance",
      rho: h.compliance_asri.rho,
      p: h.compliance_asri.p,
      n: h.compliance_asri.n,
    },
    {
      label: "ASRᵢ → target ASR",
      rho: h.asr_transfer.rho,
      p: h.asr_transfer.p,
      n: h.asr_transfer.n,
    },
    {
      label: "Compliance → session ASR",
      rho: COMPLIANCE_SESSION_ASR.rho,
      p: COMPLIANCE_SESSION_ASR.p,
      n: COMPLIANCE_SESSION_ASR.n,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Bias-injection correlations
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Spearman ρ across the 50 (agent × family) cells under bias injection.
        </p>
      </div>
      <div className="mt-4 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Relationship</TableHead>
              <TableHead className="text-foreground text-right">ρ</TableHead>
              <TableHead className="text-foreground text-right">p</TableHead>
              <TableHead className="text-foreground text-right">n</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.rho >= 0 ? "+" : ""}
                  {r.rho.toFixed(3)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatP(r.p)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.n}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 md:hidden space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-md border border-border bg-muted/30 px-3 py-2.5"
          >
            <div className="text-sm font-medium text-foreground">{r.label}</div>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ρ</div>
                <div className="text-foreground">
                  {r.rho >= 0 ? "+" : ""}
                  {r.rho.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">p</div>
                <div className="text-foreground">{formatP(r.p)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">n</div>
                <div className="text-foreground">{r.n}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Per-agent summary table ----

function PerAgentSummaryTable({ rows }: { rows: ObsInjBar[] }) {
  const sorted = [...rows].sort((a, b) => a.delta - b.delta);
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      {/* Desktop: full table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Agent</TableHead>
              <TableHead className="text-foreground text-right">obs ASR</TableHead>
              <TableHead className="text-foreground text-right">inj ASR</TableHead>
              <TableHead className="text-foreground text-right">ΔASR</TableHead>
              <TableHead className="text-foreground text-right">compliance</TableHead>
              <TableHead className="text-foreground text-right">sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.agent}>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="font-medium">{r.label}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.obs.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.inj.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta.toFixed(2)} pp
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.compliance.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.sessions}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {sorted.map((r) => (
          <div
            key={r.agent}
            className="rounded-md border border-border bg-muted/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="text-sm font-medium text-foreground">{r.label}</span>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {r.sessions} sessions
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono tabular-nums">
              <PerAgentStat label="obs ASR" value={`${r.obs.toFixed(2)}%`} />
              <PerAgentStat label="inj ASR" value={`${r.inj.toFixed(2)}%`} />
              <PerAgentStat
                label="ΔASR"
                value={`${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} pp`}
              />
              <PerAgentStat label="compliance" value={`${r.compliance.toFixed(1)}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerAgentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
