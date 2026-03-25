"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { AnalysisResults } from "@/lib/types";
import { AGENTS, AGENT_LABELS, AGENT_ICONS, MODEL_COLORS, TARGET_LABELS } from "@/lib/types";
import { FadeIn } from "@/components/fade-in";
import { BiasHeatmap } from "@/components/bias-heatmap";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── helpers ────────────────────────────────────────────────────────────────

const bp = process.env.NODE_ENV === "production" ? "/CyBiasBench" : "";

function Icon({ agent, sm }: { agent: string; sm?: boolean }) {
  const outer = sm ? "w-5 h-5" : "w-6 h-6";
  const inner = sm ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className={`${outer} rounded-full bg-white flex items-center justify-center shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${bp}${AGENT_ICONS[agent] ?? ""}`} alt={agent} className={inner} />
    </div>
  );
}

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return n.toFixed(d);
}
function fmtPct(n: number | null | undefined, d = 1): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return `${(n * 100).toFixed(d)}%`;
}
function fmtInt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return n.toLocaleString();
}
function fmtTps(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1000).toFixed(0)}K`;
}
function tLabel(t: string): string {
  return TARGET_LABELS[t] ?? t;
}

const EXCLUDE_TECHS = new Set(["deserialization"]);

/** Returns "font-bold text-foreground" if value is the best in column, else "" */
function best(values: (number | null | undefined)[], idx: number, higher = true): string {
  const valid = values.map((v, i) => ({ v: v ?? null, i })).filter((x) => x.v != null);
  if (valid.length === 0) return "";
  const bestIdx = higher
    ? valid.reduce((a, b) => ((b.v as number) > (a.v as number) ? b : a)).i
    : valid.reduce((a, b) => ((b.v as number) < (a.v as number) ? b : a)).i;
  return idx === bestIdx ? "font-bold text-foreground" : "";
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-serif text-3xl text-foreground">{title}</h2>
      <p className="mt-2 text-base text-muted-foreground max-w-3xl">{desc}</p>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: string; label: string; color?: "red" | "green" | "auto" }) {
  let textClass = "text-foreground";
  if (color === "red") textClass = "text-red-400";
  else if (color === "green") textClass = "text-emerald-400";
  else if (color === "auto") textClass = value.startsWith("-") ? "text-red-400" : "text-emerald-400";
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-5 py-4">
      <span className={`font-mono text-2xl font-bold ${textClass}`}>{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── Agent Row helper for tables ────────────────────────────────────────────

function AgentCell({ agent }: { agent: string }) {
  return (
    <td className="px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon agent={agent} />
        <span className="font-medium text-foreground">{AGENT_LABELS[agent] ?? agent}</span>
      </div>
    </td>
  );
}

// ===========================================================================
// Tab 1: Technique Bias
// ===========================================================================
function TechniqueBiasTab({ data }: { data: AnalysisResults }) {
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);
  const agg = data.aggregated_by_agent;

  // All techniques sorted by total volume (excl deserialization)
  const allTechs = new Set<string>();
  agents.forEach((a) => {
    Object.keys(agg[a]?.technique_distribution ?? {}).forEach((t) => {
      if (!EXCLUDE_TECHS.has(t)) allTechs.add(t);
    });
  });
  const techniques = [...allTechs].sort((a, b) => {
    const sa = agents.reduce((s, ag) => s + (agg[ag]?.technique_distribution?.[a] ?? 0), 0);
    const sb = agents.reduce((s, ag) => s + (agg[ag]?.technique_distribution?.[b] ?? 0), 0);
    return sb - sa;
  });

  // Heatmap values: selection rate
  const selValues: Record<string, Record<string, number>> = {};
  for (const a of agents) {
    const dist = agg[a]?.technique_distribution ?? {};
    const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
    selValues[a] = {};
    for (const t of techniques) selValues[a][t] = (dist[t] ?? 0) / total;
  }

  // JSD
  const jsd = data.statistical_tests.jsd_analysis;

  // Per-technique breakdown
  const biasAsr = data.bias_asr_correlation;

  return (
    <div className="space-y-12">
      {/* Technique Distribution Heatmap */}
      <FadeIn>
        <SectionHeader title="Technique Distribution" desc="Selection rate (Sel%) per technique per agent. Color intensity relative within each column." />
        <BiasHeatmap
          title=""
          description=""
          agents={[...agents]}
          columns={techniques}
          getValue={(agent, tech) => {
            const dist = agg[agent]?.technique_distribution ?? {};
            const total = Object.values(dist).reduce((s, v) => s + v, 0);
            if (total === 0) return null;
            const count = dist[tech] ?? 0;
            return count > 0 ? count / total : null;
          }}
          formatValue={(v) => `${(v * 100).toFixed(1)}%`}
          inline
        />
      </FadeIn>

      {/* Entropy & Concentration */}
      <FadeIn>
        <SectionHeader title="Diversity Metrics" desc="Technique entropy (H) and concentration (HHI) per agent." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">H(X) <span className="text-xs font-normal text-muted-foreground block">Entropy</span></th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">HHI <span className="text-xs font-normal text-muted-foreground block">Concentration</span></th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Top Technique <span className="text-xs font-normal text-muted-foreground block">Highest Sel%</span></th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Unique Techs</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, ai) => {
                const hVals = agents.map((ag) => agg[ag]?.shannon_entropy);
                const hhiVals = agents.map((ag) => agg[ag]?.hhi);
                const techVals = agents.map((ag) => Object.keys(agg[ag]?.technique_distribution ?? {}).filter(t => !EXCLUDE_TECHS.has(t)).length);
                return (
                <tr key={a} className="border-t border-border">
                  <AgentCell agent={a} />
                  <td className={`text-right px-5 py-4 font-mono text-base ${best(hVals, ai, true)}`}>{fmt(agg[a]?.shannon_entropy, 2)}</td>
                  <td className={`text-right px-5 py-4 font-mono text-base ${best(hhiVals, ai, false)}`}>{fmt(agg[a]?.hhi, 3)}</td>
                  <td className="text-right px-5 py-4 font-mono text-base">
                    {agg[a]?.top_technique ? (
                      <span>{agg[a]!.top_technique!.technique} <span className="text-muted-foreground">({fmtPct(agg[a]!.top_technique!.share_pct)})</span></span>
                    ) : "\u2014"}
                  </td>
                  <td className={`text-right px-5 py-4 font-mono text-base ${best(techVals, ai, true)}`}>
                    {Object.keys(agg[a]?.technique_distribution ?? {}).filter(t => !EXCLUDE_TECHS.has(t)).length}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* JSD Pairwise */}
      <FadeIn>
        <SectionHeader title="Distribution Divergence (JSD)" desc="Jensen-Shannon Divergence between agent pairs. 0 = identical, 1 = maximally different." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Pair</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">JSD</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(jsd.jsd).map(([pair, value]) => (
                <tr key={pair} className="border-t border-border">
                  <td className="px-5 py-4 text-base text-foreground">{pair.replace(/_vs_/g, " vs ")}</td>
                  <td className="text-right px-5 py-4 font-mono text-base">{(value as number).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Per-Technique ASR Heatmap */}
      {biasAsr && (() => {
        const techniques = Object.entries(biasAsr.per_technique)
          .filter(([t]) => !EXCLUDE_TECHS.has(t))
          .sort(([, a], [, b]) => b.total_attempts - a.total_attempts)
          .map(([t]) => t);

        return (
          <FadeIn>
            <BiasHeatmap
              title="Per-technique ASR"
              description="Attack success rate per technique. Compares effectiveness across agents."
              agents={agents}
              columns={techniques}
              getValue={(agent, tech) => {
                const techAsr = data.aggregated_by_agent[agent]?.per_technique_asr?.[tech];
                return techAsr ? techAsr.asr : null;
              }}
              formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              inline
            />
          </FadeIn>
        );
      })()}

      {/* Preference Index Comparison */}
      {(() => {
        // Aggregate PI per technique per agent from per_experiment
        const agentTechPi: Record<string, Record<string, { sum: number; count: number }>> = {};
        for (const exp of data.per_experiment) {
          if (!exp.preference_index) continue;
          if (!agentTechPi[exp.agent]) agentTechPi[exp.agent] = {};
          for (const [tech, pi] of Object.entries(exp.preference_index)) {
            if (EXCLUDE_TECHS.has(tech)) continue;
            if (!agentTechPi[exp.agent][tech]) agentTechPi[exp.agent][tech] = { sum: 0, count: 0 };
            agentTechPi[exp.agent][tech].sum += pi;
            agentTechPi[exp.agent][tech].count += 1;
          }
        }

        const allTechsPI = new Set<string>();
        agents.forEach((a) => Object.keys(agentTechPi[a] ?? {}).forEach((t) => allTechsPI.add(t)));
        const sortedTechs = [...allTechsPI].sort((a, b) => {
          const maxA = Math.max(...agents.map((ag) => { const d = agentTechPi[ag]?.[a]; return d ? d.sum / d.count : 0; }));
          const maxB = Math.max(...agents.map((ag) => { const d = agentTechPi[ag]?.[b]; return d ? d.sum / d.count : 0; }));
          return maxB - maxA;
        });

        if (sortedTechs.length === 0) return null;

        // Max PI per agent for bar normalization
        const agentMaxPi = agents.map((a) => {
          let max = 0;
          for (const t of sortedTechs) {
            const d = agentTechPi[a]?.[t];
            if (d) max = Math.max(max, d.sum / d.count);
          }
          return max || 1;
        });

        return (
          <FadeIn>
            <SectionHeader
              title="Preference Index (PI)"
              desc="PI = Sel% / FSO. Higher = used frequently AND early. Core Strategy (≥0.1), Primary Tactic (0.05–0.099), Secondary (0.01–0.049), Last Resort (<0.01)."
            />
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-4 font-semibold text-foreground w-40">Technique</th>
                    {agents.map((a) => (
                      <th key={a} className="text-center px-4 py-4 font-semibold" colSpan={2}>
                        <div className="flex items-center justify-center gap-2">
                          <Icon agent={a} sm />
                          <span className="text-sm">{AGENT_LABELS[a]}</span>
                        </div>
                        <span className="text-xs font-normal text-muted-foreground">PI</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTechs.map((tech) => {
                    const perAgentPi = agents.map((a) => {
                      const d = agentTechPi[a]?.[tech];
                      return d ? d.sum / d.count : null;
                    });
                    return (
                      <tr key={tech} className="border-t border-border">
                        <td className="px-5 py-4 font-mono text-base text-foreground">{tech}</td>
                        {agents.map((a, ai) => {
                          const pi = perAgentPi[ai];
                          return (
                            <React.Fragment key={a}>
                              <td className="pl-4 pr-1 py-4">
                                <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
                                  {pi != null && (
                                    <div className="h-full rounded-full" style={{
                                      width: `${(pi / agentMaxPi[ai]) * 100}%`,
                                      backgroundColor: MODEL_COLORS[a],
                                      opacity: 0.5,
                                    }} />
                                  )}
                                </div>
                              </td>
                              <td className={`pr-4 pl-1 py-4 font-mono text-base text-right ${best(perAgentPi, ai, true)}`}>
                                {pi != null ? pi.toFixed(3) : "\u2014"}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FadeIn>
        );
      })()}
    </div>
  );
}

// ===========================================================================
// Tab 2: Attack Success
// ===========================================================================
function AttackSuccessTab({ data }: { data: AnalysisResults }) {
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);
  const agg = data.aggregated_by_agent;
  const targets = Object.keys(data.aggregated_by_target).sort();

  // All techniques for per-technique ASR
  const allTechs = new Set<string>();
  agents.forEach((a) => {
    Object.keys(agg[a]?.per_technique_asr ?? {}).forEach((t) => {
      if (!EXCLUDE_TECHS.has(t)) allTechs.add(t);
    });
  });
  const techniques = [...allTechs].sort((a, b) => {
    const sa = agents.reduce((s, ag) => s + (agg[ag]?.per_technique_asr?.[a]?.attempted ?? 0), 0);
    const sb = agents.reduce((s, ag) => s + (agg[ag]?.per_technique_asr?.[b]?.attempted ?? 0), 0);
    return sb - sa;
  });

  return (
    <div className="space-y-12">
      {/* Overall ASR by Agent */}
      <FadeIn>
        <SectionHeader title="Overall Performance" desc="ASR, cost efficiency, and token usage per agent." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">ASR</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Attacks</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Successes</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">TPS</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Cost/Success</th>
                <th className="text-right px-5 py-4 font-semibold text-foreground">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, ai) => {
                const asrVals = agents.map((ag) => agg[ag]?.overall_asr);
                const tpsVals = agents.map((ag) => agg[ag]?.tokens_per_success);
                const costVals = agents.map((ag) => agg[ag]?.cost_per_success);
                const totalCostVals = agents.map((ag) => agg[ag]?.total_cost_usd);
                return (
                  <tr key={a} className="border-t border-border">
                    <AgentCell agent={a} />
                    <td className={`text-right px-5 py-4 font-mono text-base ${best(asrVals, ai, true)}`}>{fmtPct(agg[a]?.overall_asr)}</td>
                    <td className="text-right px-5 py-4 font-mono text-base">{fmtInt(agg[a]?.total_attack_requests)}</td>
                    <td className="text-right px-5 py-4 font-mono text-base">{fmtInt(agg[a]?.total_successful_attacks)}</td>
                    <td className={`text-right px-5 py-4 font-mono text-base ${best(tpsVals, ai, false)}`}>{fmtTps(agg[a]?.tokens_per_success)}</td>
                    <td className={`text-right px-5 py-4 font-mono text-base ${best(costVals, ai, false)}`}>{agg[a]?.cost_per_success != null ? `$${fmt(agg[a]!.cost_per_success, 2)}` : "\u2014"}</td>
                    <td className={`text-right px-5 py-4 font-mono text-base ${best(totalCostVals, ai, false)}`}>${fmt(agg[a]?.total_cost_usd, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* ASR by Target */}
      <FadeIn>
        <SectionHeader title="ASR by Target" desc="Attack success rate per agent per target application." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                {targets.map((t) => (
                  <th key={t} className="text-right px-5 py-4 font-semibold text-foreground">{tLabel(t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, ai) => (
                <tr key={a} className="border-t border-border">
                  <AgentCell agent={a} />
                  {targets.map((t) => {
                    const vals = agents.map((ag) => data.aggregated_by_target[t]?.[ag]?.overall_asr);
                    return (
                      <td key={t} className={`text-right px-5 py-4 font-mono text-base ${best(vals, ai, true)}`}>
                        {fmtPct(data.aggregated_by_target[t]?.[a]?.overall_asr)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Challenges */}
      {agents.some((a) => agg[a]?.total_solved_challenges != null) && (
        <FadeIn>
          <SectionHeader title="Challenge Results" desc="Ground-truth verified challenges solved per agent." />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Solved</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Challenge ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Tokens/Challenge</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a} className="border-t border-border">
                    <AgentCell agent={a} />
                    <td className="text-right px-5 py-4 font-mono text-base">{fmtInt(agg[a]?.total_solved_challenges)}</td>
                    <td className="text-right px-5 py-4 font-mono text-base">{fmtPct(agg[a]?.avg_challenge_asr)}</td>
                    <td className="text-right px-5 py-4 font-mono text-base">{fmtTps(agg[a]?.tokens_per_challenge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 3: Agent Bias (H(X), ASR, TPS, Mismatch)
// ===========================================================================
function AgentBiasTab({ data }: { data: AnalysisResults }) {
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);
  const agg = data.aggregated_by_agent;

  const metrics = [
    { key: "asr", label: "ASR", desc: "Attack Success Rate", get: (a: string) => agg[a]?.overall_asr, fmt: (v: number) => fmtPct(v), higher: true },
    { key: "entropy", label: "H(X)", desc: "Technique Entropy", get: (a: string) => agg[a]?.shannon_entropy, fmt: (v: number) => v.toFixed(2), higher: true },
    { key: "tps", label: "TPS", desc: "Token Cost per Success", get: (a: string) => agg[a]?.tokens_per_success, fmt: (v: number) => fmtTps(v), higher: false },
    { key: "mismatch", label: "Mismatch", desc: "Wasted Effort Ratio", get: (a: string) => agg[a]?.avg_mismatch ?? agg[a]?.avg_hallucinated_attack_bias, fmt: (v: number) => fmtPct(v), higher: false },
  ];

  return (
    <div className="space-y-12">
      <FadeIn>
        <SectionHeader
          title="Agent Bias Metrics"
          desc="4 core metrics measuring agent-level strategic bias. H(X) = diversity, ASR = success rate, TPS = efficiency, Mismatch = wasted effort."
        />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                {metrics.map((m) => (
                  <th key={m.key} className="text-right px-5 py-4 font-semibold text-foreground">
                    {m.label}
                    <span className="text-xs font-normal text-muted-foreground block">{m.desc}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, ai) => (
                <tr key={a} className="border-t border-border">
                  <AgentCell agent={a} />
                  {metrics.map((m) => {
                    const v = m.get(a);
                    const vals = agents.map((ag) => m.get(ag));
                    const cls = best(vals, ai, m.higher);
                    return (
                      <td key={m.key} className={`text-right px-5 py-4 font-mono text-base ${cls}`}>
                        {v != null ? m.fmt(v) : "\u2014"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Per-condition breakdown */}
      <FadeIn>
        <SectionHeader title="By Condition" desc="Agent Bias Metrics broken down by the 4 prompt conditions." />
        {["guided_structured", "guided_unstructured", "unguided_structured", "unguided_unstructured"].map((cond) => {
          const condAgg = data.aggregated_by_condition?.[cond];
          if (!condAgg) return null;
          const condLabel = cond.replace("_", " / ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());
          return (
            <div key={cond} className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">{condLabel}</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 font-semibold text-foreground">Agent</th>
                      <th className="text-right px-5 py-3 font-semibold text-foreground">H(X)</th>
                      <th className="text-right px-5 py-3 font-semibold text-foreground">ASR</th>
                      <th className="text-right px-5 py-3 font-semibold text-foreground">TPS</th>
                      <th className="text-right px-5 py-3 font-semibold text-foreground">Mismatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => {
                      const ca = condAgg[a];
                      if (!ca) return null;
                      return (
                        <tr key={a} className="border-t border-border">
                          <AgentCell agent={a} />
                          <td className="text-right px-5 py-3 font-mono text-base">{fmt(ca.shannon_entropy, 2)}</td>
                          <td className="text-right px-5 py-3 font-mono text-base">{fmtPct(ca.overall_asr)}</td>
                          <td className="text-right px-5 py-3 font-mono text-base">{fmtTps(ca.tokens_per_success)}</td>
                          <td className="text-right px-5 py-3 font-mono text-base">{fmtPct(ca.avg_mismatch ?? ca.avg_hallucinated_attack_bias)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </FadeIn>
    </div>
  );
}

// ===========================================================================
// Tab 4: Cross-Target
// ===========================================================================
function CrossTargetTab({ data }: { data: AnalysisResults }) {
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);
  const targets = Object.keys(data.aggregated_by_target).sort();
  const cross = data.cross_target_shift;

  return (
    <div className="space-y-12">
      {/* ASR by Target */}
      <FadeIn>
        <SectionHeader title="ASR by Target" desc="How attack success rate varies across target applications." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                {targets.map((t) => (
                  <th key={t} className="text-right px-5 py-4 font-semibold text-foreground">{tLabel(t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, ai) => (
                <tr key={a} className="border-t border-border">
                  <AgentCell agent={a} />
                  {targets.map((t) => {
                    const vals = agents.map((ag) => data.aggregated_by_target[t]?.[ag]?.overall_asr);
                    return (
                      <td key={t} className={`text-right px-5 py-4 font-mono text-base ${best(vals, ai, true)}`}>
                        {fmtPct(data.aggregated_by_target[t]?.[a]?.overall_asr)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* JSD Shift */}
      <FadeIn>
        <SectionHeader title="Technique Shift (JSD)" desc="How much each agent's technique distribution changes between targets." />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                {Object.keys(cross[agents[0]] ?? {}).map((pair) => (
                  <th key={pair} className="text-right px-5 py-4 font-semibold text-foreground text-sm">
                    {pair.split("_vs_").map(tLabel).join(" vs ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a} className="border-t border-border">
                  <AgentCell agent={a} />
                  {Object.entries(cross[a] ?? {}).map(([pair, info]) => (
                    <td key={pair} className="text-right px-5 py-4 font-mono text-base">
                      {fmt(info.jsd, 4)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Per-target technique distribution */}
      {targets.map((target) => {
        const targetAgg = data.aggregated_by_target[target];
        const techs = new Set<string>();
        agents.forEach((a) => {
          Object.entries(targetAgg?.[a]?.technique_distribution ?? {}).forEach(([t, c]) => {
            if (c > 0 && !EXCLUDE_TECHS.has(t)) techs.add(t);
          });
        });
        const sortedTechs = [...techs].sort((a, b) => {
          const sa = agents.reduce((s, ag) => s + (targetAgg?.[ag]?.technique_distribution?.[a] ?? 0), 0);
          const sb = agents.reduce((s, ag) => s + (targetAgg?.[ag]?.technique_distribution?.[b] ?? 0), 0);
          return sb - sa;
        });

        return (
          <FadeIn key={target}>
            <SectionHeader title={tLabel(target)} desc={`Technique distribution for ${tLabel(target)}`} />
            <BiasHeatmap
              title="" description=""
              agents={[...agents]}
              columns={sortedTechs}
              getValue={(agent, tech) => {
                const dist = targetAgg?.[agent]?.technique_distribution ?? {};
                const total = Object.values(dist).reduce((s, v) => s + v, 0);
                if (total === 0) return null;
                const c = dist[tech] ?? 0;
                return c > 0 ? c / total : null;
              }}
              formatValue={(v) => `${(v * 100).toFixed(1)}%`}
              inline
            />
          </FadeIn>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Tab 5: Conditions
// ===========================================================================
function ConditionsTab({ data }: { data: AnalysisResults }) {
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);

  return (
    <div className="space-y-12">
      {/* Guided vs Unguided */}
      {data.guided_vs_unguided && (
        <FadeIn>
          <SectionHeader title="Guided vs Unguided" desc="Comparing agent behavior when technique labels are provided vs withheld." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard value={fmtPct(data.guided_vs_unguided.summary.guided_mean_asr)} label="Guided Mean ASR" />
            <StatCard value={fmtPct(data.guided_vs_unguided.summary.unguided_mean_asr)} label="Unguided Mean ASR" />
            <StatCard
              value={`${data.guided_vs_unguided.summary.overall_delta_asr >= 0 ? "+" : ""}${fmtPct(data.guided_vs_unguided.summary.overall_delta_asr)}`}
              label="Delta ASR"
              color="auto"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Guided ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Unguided ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Delta ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Delta H</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">JSD Shift</th>
                </tr>
              </thead>
              <tbody>
                {agents.filter((a) => data.guided_vs_unguided!.by_agent[a]).map((a) => {
                  const d = data.guided_vs_unguided!.by_agent[a];
                  return (
                    <tr key={a} className="border-t border-border">
                      <AgentCell agent={a} />
                      <td className="text-right px-5 py-4 font-mono text-base">{fmtPct(d.guided.asr)}</td>
                      <td className="text-right px-5 py-4 font-mono text-base">{fmtPct(d.unguided.asr)}</td>
                      <td className={`text-right px-5 py-4 font-mono text-base ${d.delta_asr < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {d.delta_asr >= 0 ? "+" : ""}{fmtPct(d.delta_asr)}
                      </td>
                      <td className={`text-right px-5 py-4 font-mono text-base ${d.delta_entropy > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {d.delta_entropy >= 0 ? "+" : ""}{fmt(d.delta_entropy, 3)}
                      </td>
                      <td className="text-right px-5 py-4 font-mono text-base">{fmt(d.technique_shift_jsd, 4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      {/* Structured vs Unstructured */}
      {data.structured_vs_unstructured && (
        <FadeIn>
          <SectionHeader title="Structured vs Unstructured" desc="Comparing agent behavior under JSONL output format vs free-form Markdown." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard value={fmtPct(data.structured_vs_unstructured.summary.structured_mean_asr)} label="Structured Mean ASR" />
            <StatCard value={fmtPct(data.structured_vs_unstructured.summary.unstructured_mean_asr)} label="Unstructured Mean ASR" />
            <StatCard
              value={`${data.structured_vs_unstructured.summary.overall_delta_asr >= 0 ? "+" : ""}${fmtPct(data.structured_vs_unstructured.summary.overall_delta_asr)}`}
              label="Delta ASR"
              color="auto"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-4 font-semibold text-foreground">Agent</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Structured ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Unstructured ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Delta ASR</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">Delta H</th>
                  <th className="text-right px-5 py-4 font-semibold text-foreground">JSD Shift</th>
                </tr>
              </thead>
              <tbody>
                {agents.filter((a) => data.structured_vs_unstructured!.by_agent[a]).map((a) => {
                  const d = data.structured_vs_unstructured!.by_agent[a];
                  return (
                    <tr key={a} className="border-t border-border">
                      <AgentCell agent={a} />
                      <td className="text-right px-5 py-4 font-mono text-base">{fmtPct(d.structured.asr)}</td>
                      <td className="text-right px-5 py-4 font-mono text-base">{fmtPct(d.unstructured.asr)}</td>
                      <td className={`text-right px-5 py-4 font-mono text-base ${d.delta_asr < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {d.delta_asr >= 0 ? "+" : ""}{fmtPct(d.delta_asr)}
                      </td>
                      <td className={`text-right px-5 py-4 font-mono text-base ${d.delta_entropy > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {d.delta_entropy >= 0 ? "+" : ""}{fmt(d.delta_entropy, 3)}
                      </td>
                      <td className="text-right px-5 py-4 font-mono text-base">{fmt(d.technique_shift_jsd, 4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 6: Data
// ===========================================================================
function DataTab({ data }: { data: AnalysisResults }) {
  return (
    <FadeIn>
      <SectionHeader title="Data Access" desc="Download the full analysis results for your own research." />
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <a
            href={`${bp}/data/analysis_results.json`}
            download="analysis_results.json"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            Analysis Results (JSON)
          </a>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(data.per_experiment, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "per_experiment.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            Per-Experiment Data (JSON)
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          108 experiments &middot; 3 agents &middot; 3 targets &middot; 4 conditions &middot; 3 runs
        </p>
      </div>
    </FadeIn>
  );
}

// ===========================================================================
// Main Page
// ===========================================================================

const TAB_IDS = ["technique", "attack", "bias", "cross-target", "conditions"] as const;
type TabId = typeof TAB_IDS[number];

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("technique");

  useEffect(() => {
    fetch(`${bp}/data/analysis_results.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json as AnalysisResults))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (TAB_IDS.includes(hash)) setActiveTab(hash);
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
  };

  return (
    <div className="flex flex-col min-h-0">
      <FadeIn>
        <div className="pt-24 pb-8 max-w-[1300px] mx-auto px-6">
          <h1 className="font-serif text-4xl text-foreground">Detailed Analysis</h1>
          <p className="mt-2 text-base text-muted-foreground">
            In-depth bias metrics and comparisons across {Object.keys(data?.aggregated_by_agent ?? {}).length || 3} agents, 108 experiments.
          </p>
        </div>
      </FadeIn>

      {error && (
        <div className="max-w-[1300px] mx-auto px-6 mb-4">
          <p className="text-destructive text-base font-mono">{error}</p>
        </div>
      )}

      <div className="max-w-[1300px] mx-auto px-6 w-full pb-24">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-8">
            <TabsTrigger value="technique">Technique Bias</TabsTrigger>
            <TabsTrigger value="attack">Attack Success</TabsTrigger>
            <TabsTrigger value="bias">Agent Bias</TabsTrigger>
            <TabsTrigger value="cross-target">Cross-Target</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            {/* <TabsTrigger value="data">Data</TabsTrigger> */}
          </TabsList>

          <TabsContent value="technique">
            {data ? <TechniqueBiasTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent>
          <TabsContent value="attack">
            {data ? <AttackSuccessTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent>
          <TabsContent value="bias">
            {data ? <AgentBiasTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent>
          <TabsContent value="cross-target">
            {data ? <CrossTargetTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent>
          <TabsContent value="conditions">
            {data ? <ConditionsTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent>
          {/* <TabsContent value="data">
            {data ? <DataTab data={data} /> : <div className="animate-pulse rounded-md bg-muted h-64" />}
          </TabsContent> */}
        </Tabs>
      </div>
    </div>
  );
}
