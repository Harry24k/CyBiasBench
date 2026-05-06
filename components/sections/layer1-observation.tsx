"use client";

import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { ConditionHeatmapGrid } from "@/components/charts/condition-heatmap-grid";
import { AGENT_LABELS } from "@/lib/types";
import type { PaperSummary } from "@/lib/types";
import { useAgentColors, useTheme } from "@/lib/use-theme";

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
    const [mantissa, e] = exp.split("e");
    return `${mantissa}\u00D7\u200910${toSuper(String(parseInt(e, 10)))}`;
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
              session, and dominant-family share. Low H(X) and high Top % signal narrow preference.
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
}) {
  return (
    <>
      <div className="px-5 py-4 border-t border-border flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-foreground">
          {AGENT_LABELS[agent] ?? agent}
        </span>
      </div>
      <BarCell value={entropy} max={maxH} color={color} format={(v) => v.toFixed(2)} />
      <BarCell value={unique} max={maxUniq} color={color} format={(v) => v.toFixed(1)} />
      <BarCell
        value={topShare}
        max={100}
        color={color}
        format={(v) => `${v.toFixed(1)}%`}
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
          suffix={
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              tok/✓
            </span>
          }
        />
      ) : (
        <div className="px-5 py-4 border-t border-border text-right text-muted-foreground">—</div>
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
}: {
  value: number;
  max: number;
  color: string;
  format: (v: number) => string;
  suffix?: React.ReactNode;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="px-5 py-4 border-t border-border">
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
    </div>
  );
}
