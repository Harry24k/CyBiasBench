"use client";

import { useEffect, useState } from "react";
import { HeroSection } from "@/components/hero-section";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { BiasHeatmap } from "@/components/bias-heatmap";
import { FadeIn } from "@/components/fade-in";
import type { AnalysisResults } from "@/lib/types";
import { BASE_PATH } from "@/lib/utils";

export default function Home() {
  const [data, setData] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/data/analysis_results.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen">
      <FadeIn>
        <HeroSection />
      </FadeIn>

      <div className="pb-24 space-y-24">
        {error && (
          <div className="max-w-[1300px] mx-auto px-6 text-center py-16">
            <p className="text-destructive text-sm">Failed to load data: {error}</p>
          </div>
        )}

        {!data && !error && (
          <div className="max-w-[1300px] mx-auto px-6">
            <div className="h-9 w-48 rounded bg-muted animate-pulse mb-4" />
            <div className="rounded-lg border border-border overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 border-b border-border flex items-center px-4 gap-4">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse ml-auto" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Bias Metrics */}
        {data && (
          <FadeIn>
            <LeaderboardTable data={data} />
          </FadeIn>
        )}

        {/* Technique Bias Metrics */}
        {data && (() => {
          const agents = Object.keys(data.aggregated_by_agent);

          const techTotals: Record<string, number> = {};
          for (const a of agents) {
            const dist = data.aggregated_by_agent[a]?.technique_distribution ?? {};
            for (const [tech, count] of Object.entries(dist)) {
              techTotals[tech] = (techTotals[tech] ?? 0) + count;
            }
          }
          const EXCLUDE_TECHS = new Set(["deserialization"]);
          const techniques = Object.entries(techTotals)
            .filter(([t]) => !EXCLUDE_TECHS.has(t))
            .sort(([, a], [, b]) => b - a)
            .map(([t]) => t);

          return (
            <FadeIn>
              <section className="max-w-[1300px] mx-auto px-6 space-y-10">
                <div>
                  <h2 className="font-serif text-3xl text-foreground">
                    Technique Bias Metrics
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                    Per-technique selection bias and effectiveness. Selection Rate (Sel%) measures how often
                    each technique is chosen; Per-technique ASR measures how effective it actually is.
                  </p>
                </div>

                <FadeIn delay={100}>
                  <BiasHeatmap
                    title="Selection Rate (Sel%)"
                    description="Proportion of total attacks allocated to each technique. Reveals which techniques each agent preferentially selects."
                    agents={agents}
                    columns={techniques}
                    getValue={(agent, tech) => {
                      const dist = data.aggregated_by_agent[agent]?.technique_distribution ?? {};
                      const total = Object.values(dist).reduce((s, v) => s + v, 0);
                      if (total === 0) return null;
                      const count = dist[tech] ?? 0;
                      return count > 0 ? count / total : null;
                    }}
                    formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                    inline
                  />
                </FadeIn>

                <FadeIn delay={200}>
                  <BiasHeatmap
                    title="Per-technique ASR"
                    description="Attack success rate per technique. Combined with Sel% to determine whether frequently chosen techniques are actually effective."
                    agents={agents}
                    columns={techniques}
                    getValue={(agent, tech) => {
                      const techAsr = data.aggregated_by_agent[agent]?.per_technique_asr?.[tech];
                      return techAsr != null ? techAsr.asr : null;
                    }}
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    inline
                  />
                </FadeIn>
              </section>
            </FadeIn>
          );
        })()}

        {/* Preference Index */}
        {data && (() => {
          const agents = Object.keys(data.aggregated_by_agent);

          const agentTechPi: Record<string, Record<string, { sum: number; count: number }>> = {};
          for (const exp of data.per_experiment) {
            if (!exp.preference_index) continue;
            if (!agentTechPi[exp.agent]) agentTechPi[exp.agent] = {};
            for (const [tech, pi] of Object.entries(exp.preference_index)) {
              if (!agentTechPi[exp.agent][tech]) agentTechPi[exp.agent][tech] = { sum: 0, count: 0 };
              agentTechPi[exp.agent][tech].sum += pi;
              agentTechPi[exp.agent][tech].count += 1;
            }
          }

          const EXCLUDE_TECHS = new Set(["deserialization"]);
          const allTechs = new Set<string>();
          for (const agent of agents) {
            for (const tech of Object.keys(agentTechPi[agent] ?? {})) {
              if (!EXCLUDE_TECHS.has(tech)) allTechs.add(tech);
            }
          }
          const techniques = [...allTechs].sort((a, b) => {
            const maxA = Math.max(...agents.map(ag => {
              const d = agentTechPi[ag]?.[a];
              return d ? d.sum / d.count : 0;
            }));
            const maxB = Math.max(...agents.map(ag => {
              const d = agentTechPi[ag]?.[b];
              return d ? d.sum / d.count : 0;
            }));
            return maxB - maxA;
          });

          if (techniques.length === 0) return null;

          return (
            <FadeIn>
              <section className="max-w-[1300px] mx-auto px-6 space-y-6">
                <div>
                  <h2 className="font-serif text-3xl text-foreground">
                    Preference Index
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                    PI = Sel% / FSO. Captures temporal ordering — techniques used frequently AND early
                    score highest. Core Strategy (&ge;0.1), Primary Tactic (0.05&ndash;0.099),
                    Secondary (0.01&ndash;0.049), Last Resort (&lt;0.01).
                  </p>
                </div>

                <FadeIn delay={100}>
                  <BiasHeatmap
                    title="PI by Technique"
                    description="Average Preference Index per technique across all sessions. Higher = stronger inherent preference."
                    agents={agents}
                    columns={techniques}
                    getValue={(agent, tech) => {
                      const d = agentTechPi[agent]?.[tech];
                      return d ? d.sum / d.count : null;
                    }}
                    formatValue={(v) => v.toFixed(3)}
                    inline
                  />
                </FadeIn>
              </section>
            </FadeIn>
          );
        })()}
      </div>
    </main>
  );
}
