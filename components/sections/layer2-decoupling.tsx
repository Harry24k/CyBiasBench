"use client";

import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { SelVsAsrRadar } from "@/components/charts/sel-vs-asr-radar";
import { EntropyAsrScatter } from "@/components/charts/entropy-asr-scatter";
import { EffectSizeBar } from "@/components/charts/effect-size-bar";
import type { PaperSummary } from "@/lib/types";

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

export function Layer2Decoupling({ data }: { data: PaperSummary }) {
  const agents = data.agents;
  const families = data.families;
  const selPerAgent = data.fig3_selection_per_agent;
  const asrPerAgent = data.fig3_asri_per_agent;
  const scatter = data.fig4_entropy_asr_scatter;
  const rhoTable = data.table3_entropy_asr_rho;
  const h = data.headline_stats;

  let maxSel = 0;
  let maxAsr = 0;
  for (const a of agents) {
    for (const f of families) {
      maxSel = Math.max(maxSel, selPerAgent[a]?.[f] ?? 0);
      maxAsr = Math.max(maxAsr, asrPerAgent[a]?.[f] ?? 0);
    }
  }

  return (
    <div className="space-y-14">
      <header className="max-w-[1500px] mx-auto px-6">
        <div className="flex items-baseline gap-4">
          <span className="text-xs font-mono text-emerald-500 tracking-widest uppercase">
            Layer 2
          </span>
          <h2 className="font-serif text-3xl text-foreground">Selection ≠ Performance</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl">
          Allocation profiles do not mirror per-family success. Families with the highest selection
          shares are often not the highest-ASR families, and session-level entropy is uncorrelated
          with session ASR for 4 of 5 agents.
        </p>
      </header>

      {h.kruskal_unique_count && h.kruskal_top_share && (
        <FadeIn>
          <section className="max-w-[1500px] mx-auto px-6">
            <EffectSizeBar
              kH={h.kruskal_H}
              kUniq={h.kruskal_unique_count}
              kTop={h.kruskal_top_share}
              kAsr={h.kruskal_session_asr}
            />
          </section>
        </FadeIn>
      )}

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                Selection vs per-family ASR (per agent)
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                Each panel contrasts the agent's own allocation profile
                (Sel<sub>i</sub>, filled) with its own per-family success rate
                (ASR<sub>i</sub>, dashed). Each metric is normalized to its
                global maximum (Sel to {Math.round(maxSel * 100)}%, ASR
                to {Math.round(maxAsr * 100)}%) so the two polygons are
                visually comparable — shape divergence reveals effort
                mis-spent on low-success families. Hover for raw values.
              </p>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground shrink-0">
              <span className="flex items-center gap-2">
                <span className="inline-block w-5 h-0 border-t-2 border-current" />
                Selection Selᵢ
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-5 h-0"
                  style={{ borderTop: "1.5px dashed currentColor" }}
                />
                ASRᵢ (same agent)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {agents.map((a) => (
              <div
                key={a}
                className="w-full md:w-[calc(50%-12px)] xl:w-[calc(33.333%-16px)] rounded-lg border border-border bg-card p-5"
              >
                <SelVsAsrRadar
                  agent={a}
                  families={families}
                  familyLabels={FAMILY_LABELS}
                  selection={selPerAgent[a] ?? {}}
                  asrPrior={asrPerAgent[a] ?? {}}
                  maxSel={maxSel}
                  maxAsr={maxAsr}
                  height={360}
                />
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              Entropy vs session ASR
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Per-session scatter (n = 36 per agent). Spearman ρ annotated per panel. Only
              Codex shows a weakly positive correlation; the rest are not significantly different
              from zero — breadth does not imply outcome.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {agents.map((a) => {
              const pts = scatter.filter((p) => p.agent === a);
              const stats = rhoTable[a];
              if (!stats) return null;
              return (
                <div
                  key={a}
                  className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] rounded-lg border border-border bg-card p-4"
                >
                  <EntropyAsrScatter
                    agent={a}
                    points={pts}
                    rho={stats.rho}
                    pValue={stats.p}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </FadeIn>

      <div className="max-w-[1500px] mx-auto px-6">
        <BridgeText>
          Selection and performance are decoupled. A natural intervention is to force the attack
          family — does this close the gap?
        </BridgeText>
      </div>
    </div>
  );
}
