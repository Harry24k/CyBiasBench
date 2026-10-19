"use client";

import { useMemo, useState } from "react";
import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { SelVsAsrRadar } from "@/components/charts/sel-vs-asr-radar";
import { EntropyAsrScatter } from "@/components/charts/entropy-asr-scatter";
import { EffectSizeBar } from "@/components/charts/effect-size-bar";
import AsrPerFamilyHeatmap from "@/components/charts/asr-per-family-heatmap";
import TemporalAdaptationBar from "@/components/charts/temporal-adaptation-bar";
import { useAgentColors, useIsMobile } from "@/lib/use-theme";
import { useT, type Lang } from "@/lib/i18n";
import { AGENT_LABELS, FAMILY_FULLNAME } from "@/lib/types";
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

interface DecouplingRow {
  agent: string;
  top_family: string;
  top_sel_pct: number; // 0-100
  top_asr_pct: number; // 0-100
  tps: number | null;
}

function formatTps(tps: number | null): string {
  if (tps == null) return "—";
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}K tok/s`;
  return `${tps.toFixed(0)} tok/s`;
}

function decouplingInterpretation(row: DecouplingRow, lang: Lang): string {
  const family = FAMILY_LABELS[row.top_family] ?? row.top_family;
  const agent = AGENT_LABELS[row.agent] ?? row.agent;
  const gap = row.top_sel_pct - row.top_asr_pct;
  const sel = row.top_sel_pct.toFixed(1);
  const asr = row.top_asr_pct.toFixed(1);
  if (gap >= 8) {
    return lang === "ko"
      ? `${agent}는 시도의 ${sel}%를 ${family}에 배분하나 그중 ${asr}%만 성공함. ${gap.toFixed(1)}포인트의 선택–실력 격차로서, 배분을 결과의 대리 지표로 사용할 수 없음을 명확히 보여줌.`
      : `${agent} commits ${sel}% of attempts to ${family}, but only ${asr}% of those attempts succeed — a ${gap.toFixed(1)}-point selection–capability gap that cleanly illustrates why allocation is not a proxy for outcome.`;
  }
  if (gap <= -8) {
    return lang === "ko"
      ? `${agent}의 최다 선택 계열은 ${family}로 선택 비중이 ${sel}%이나, 동일 계열의 ASRᵢ는 ${asr}%임. 이 경우 선택이 오히려 실력을 과소 반영함.`
      : `${agent}'s most-selected family is ${family} at ${sel}% selection, yet ASRᵢ on that same family is ${asr}% — selection actually under-represents capability here.`;
  }
  return lang === "ko"
    ? `${agent}는 시도의 ${sel}%를 ${family}에 집중하며 해당 계열 ASRᵢ도 ${asr}%로 유사함. 배분과 성과가 일치하는 드문 사례임.`
    : `${agent} concentrates ${sel}% of attempts on ${family} with a matching ASRᵢ of ${asr}% — a rare case where allocation tracks success.`;
}

function useL2(data: PaperSummary) {
  const t = useT();
  const lang = t<Lang>("en", "ko");
  const agents = data.agents;
  const families = data.families;
  const selPerAgent = data.fig3_selection_per_agent;
  const asrPerAgent = data.fig3_asri_per_agent;
  const scatter = data.fig4_entropy_asr_scatter;
  const rhoTable = data.table3_entropy_asr_rho;
  const tpsPerAgent = useMemo(() => data.tps_per_agent ?? {}, [data.tps_per_agent]);
  const h = data.headline_stats;
  const agentColors = useAgentColors();
  const isMobile = useIsMobile();


  const { maxSel, maxAsr } = useMemo(() => {
    let mSel = 0;
    let mAsr = 0;
    for (const a of agents) {
      for (const f of families) {
        mSel = Math.max(mSel, selPerAgent[a]?.[f] ?? 0);
        mAsr = Math.max(mAsr, asrPerAgent[a]?.[f] ?? 0);
      }
    }
    return { maxSel: mSel, maxAsr: mAsr };
  }, [agents, families, selPerAgent, asrPerAgent]);

  // Per-agent: index of most-selected family (column highlight in table view).
  const topSelFamily: Record<string, string> = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of agents) {
      let best = families[0];
      let bestV = -Infinity;
      for (const f of families) {
        const v = selPerAgent[a]?.[f] ?? 0;
        if (v > bestV) { bestV = v; best = f; }
      }
      out[a] = best;
    }
    return out;
  }, [agents, families, selPerAgent]);

  const decouplingSummary: DecouplingRow[] = useMemo(() => {
    const rows: DecouplingRow[] = agents.map((a) => {
      const top = topSelFamily[a];
      return {
        agent: a,
        top_family: top,
        top_sel_pct: (selPerAgent[a]?.[top] ?? 0) * 100,
        top_asr_pct: (asrPerAgent[a]?.[top] ?? 0) * 100,
        tps: tpsPerAgent[a] ?? null,
      };
    });
    rows.sort((x, y) => y.top_sel_pct - x.top_sel_pct);
    return rows;
  }, [agents, topSelFamily, selPerAgent, asrPerAgent, tpsPerAgent]);

  return { t, lang, agents, families, selPerAgent, asrPerAgent, scatter, rhoTable, tpsPerAgent, h, agentColors, isMobile, topSelFamily, decouplingSummary, maxSel, maxAsr };
}

export function Layer2Decoupling({ data }: { data: PaperSummary }) {
  const { t } = useL2(data);
  return (
    <div id="findings-layer2" className="space-y-14 scroll-mt-24">
      <header className="max-w-[800px] mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          {t("Selection ≠ Performance", "선택 ≠ 성능")}
        </h2>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl text-pretty">
          {t(
            <>
              Allocation profiles do not mirror per-family success. Most-selected families are
              frequently not the highest-ASR<sub>i</sub> families, and session-level entropy is
              uncorrelated with session ASR for 4 of 5 agents. Across-agent effect sizes confirm
              structural attack-selection metrics separate agents far more strongly than session ASR.
            </>,
            <>
              배분 프로파일은 계열별 성공률을 그대로 반영하지 않음. 최다 선택 계열이
              ASR<sub>i</sub> 최고 계열인 경우는 드물며, 5종 중 4종 에이전트에서
              세션 엔트로피와 세션 ASR 간 상관이 없음. 에이전트 간 효과크기 비교 시
              구조적 공격 선택 지표가 세션 ASR보다 훨씬 강하게 에이전트를 구분함.
            </>
          )}
        </p>
      </header>

      <L2EffectSize data={data} />

      <L2SelVsAsr data={data} />

      <L2EntropyScatter data={data} />

      <L2DecouplingCards data={data} />

      <L2AsrHeatmap data={data} />

      <L2Temporal data={data} />

      <div className="max-w-[800px] mx-auto px-4 sm:px-6">
        <BridgeText>
          {t(
            "Selection and performance are decoupled. A natural intervention is to force the attack family — does this close the gap?",
            "선택과 성능은 상호 분리되어 있음. 그렇다면 공격 계열을 강제 지정하는 개입이 이 격차를 축소할 수 있는가?"
          )}
        </BridgeText>
      </div>
    </div>
  );
}

export function L2EffectSize({ data }: { data: PaperSummary }) {
  const { h } = useL2(data);
  return (
    <>
        {h.kruskal_unique_count && h.kruskal_top_share && (
          <FadeIn>
            <section className="max-w-[800px] mx-auto px-4 sm:px-6">
              <EffectSizeBar
                kH={h.kruskal_H}
                kUniq={h.kruskal_unique_count}
                kTop={h.kruskal_top_share}
                kAsr={h.kruskal_session_asr}
              />
            </section>
          </FadeIn>
        )}
    </>
  );
}

export function L2SelVsAsr({ data }: { data: PaperSummary }) {
  const { t, agents, families, selPerAgent, asrPerAgent, agentColors, isMobile, topSelFamily, maxSel, maxAsr } = useL2(data);
  const [view, setView] = useState<"radar" | "table">("radar");
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-x-3 gap-y-2 flex-wrap w-full">
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-5 h-0 border-t-2 border-current" />
                    {t("Selection share", "선택 비중")}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-5 h-0"
                      style={{ borderTop: "1.5px dashed currentColor" }}
                    />
                    {t("Attack success rate", "공격 성공률")}
                  </span>
                </div>
                <div className="inline-flex rounded-md border border-border overflow-hidden ml-auto">
                  <button
                    type="button"
                    onClick={() => setView("radar")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === "radar"
                        ? "bg-foreground text-background"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                    aria-pressed={view === "radar"}
                  >
                    {t("Radar", "레이더")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("table")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                      view === "table"
                        ? "bg-foreground text-background"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                    aria-pressed={view === "table"}
                  >
                    {t("Table", "표")}
                  </button>
                </div>
              </div>
            </div>

            {view === "radar" ? (
              <div className="flex flex-wrap justify-center gap-6">
                {agents.map((a) => (
                  <div
                    key={a}
                    className="w-full md:w-[calc(50%-12px)] rounded-lg border border-border bg-card p-3 sm:p-4"
                  >
                    <SelVsAsrRadar
                      agent={a}
                      families={families}
                      familyLabels={FAMILY_LABELS}
                      selection={selPerAgent[a] ?? {}}
                      asrPrior={asrPerAgent[a] ?? {}}
                      maxSel={maxSel}
                      maxAsr={maxAsr}
                      height={isMobile ? 280 : 300}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-card z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        {t("Family", "계열")}
                      </th>
                      {agents.map((a) => (
                        <th
                          key={a}
                          className="text-center font-medium px-3 py-2 whitespace-nowrap"
                          style={{ color: agentColors[a] }}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: agentColors[a] }}
                            />
                            {AGENT_LABELS[a] ?? a}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {families.map((f, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-card" : "surface-band";
                      return (
                      <tr
                        key={f}
                        className={
                          idx % 2 === 0
                            ? "border-b border-border/60"
                            : "border-b border-border/60 surface-band"
                        }
                      >
                        <td
                          className={`px-3 py-2 font-medium text-foreground sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${rowBg}`}
                        >
                          <abbr
                            title={FAMILY_FULLNAME[f] ?? f}
                            className="no-underline decoration-dotted decoration-muted-foreground/40 underline underline-offset-2 cursor-help"
                          >
                            {FAMILY_LABELS[f] ?? f}
                          </abbr>
                        </td>
                        {agents.map((a) => {
                          const sel = selPerAgent[a]?.[f] ?? 0;
                          const asr = asrPerAgent[a]?.[f] ?? 0;
                          const isTop = topSelFamily[a] === f;
                          const intensity =
                            maxSel > 0 ? Math.min(1, sel / maxSel) : 0;
                          // Tint intensity from agent color, light alpha for readability.
                          const bg = `${agentColors[a]}${Math.round(
                            intensity * 60,
                          )
                            .toString(16)
                            .padStart(2, "0")}`;
                          return (
                            <td
                              key={a}
                              className="px-3 py-2 text-center font-mono tabular-nums whitespace-nowrap"
                              style={{ backgroundColor: bg }}
                            >
                              <span
                                className={
                                  isTop
                                    ? "font-bold text-foreground"
                                    : "text-foreground/85"
                                }
                              >
                                {(sel * 100).toFixed(1)}%
                              </span>
                              <span className="text-muted-foreground"> / </span>
                              <span className="text-foreground/85">
                                {(asr * 100).toFixed(1)}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                  {t(
                    <>
                      Each cell: selection share / attack success rate. Cell tint scales
                      with selection share; bold marks each agent&apos;s most-selected family.
                    </>,
                    <>
                      각 칸: 선택 비중 / 공격 성공률. 칸 색상은 선택 비중에 비례하며,
                      굵은 값은 에이전트별 최다 선택 계열임.
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </FadeIn>
    </>
  );
}

export function L2EntropyScatter({ data }: { data: PaperSummary }) {
  const { t, agents, scatter, rhoTable } = useL2(data);
  const [showRegression, setShowRegression] = useState(false);
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("Entropy vs session ASR", "엔트로피 vs 세션 ASR")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                  {t(
                    "Per-session scatter (n = 36 per agent). Spearman ρ annotated per panel. Only Codex shows a weakly positive correlation; the rest are not significantly different from zero — breadth does not imply outcome. Hover a point for session, target, and condition.",
                    "세션 단위 산점도임(에이전트당 n = 36). 패널별로 Spearman ρ를 표기함. Codex만 약한 양의 상관을 보이며 나머지는 0과 유의하게 다르지 않음. 탐색 범위가 넓다고 하여 성과가 향상되지는 않음. 점에 마우스를 올리면 세션·표적·조건이 표시됨."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegression((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border border-border transition-colors ${
                  showRegression
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={showRegression}
              >
                {showRegression
                  ? t("Hide regression line", "회귀선 숨기기")
                  : t("Show regression line", "회귀선 표시")}
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {agents.map((a) => {
                const pts = scatter.filter((p) => p.agent === a);
                const stats = rhoTable[a];
                if (!stats) return null;
                return (
                  <div
                    key={a}
                    className="w-full md:w-[calc(50%-12px)] rounded-lg border border-border bg-card p-4"
                  >
                    <EntropyAsrScatter
                      agent={a}
                      points={pts}
                      rho={stats.rho}
                      pValue={stats.p}
                      showRegression={showRegression}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>
    </>
  );
}

export function L2DecouplingCards({ data }: { data: PaperSummary }) {
  const { t, lang, agentColors, decouplingSummary } = useL2(data);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                {t("Cell-level decoupling", "셀 단위 비결합")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                {t(
                  "Each card pins down the agent's most-selected family and the ASRᵢ on that same family. Click a card to expand the interpretation.",
                  "각 카드는 해당 에이전트의 최다 선택 계열과 해당 계열의 ASRᵢ를 함께 제시함. 카드를 클릭하면 해석이 표시됨."
                )}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {decouplingSummary.map((row) => {
                const expanded = expandedAgent === row.agent;
                const color = agentColors[row.agent];
                const gap = row.top_sel_pct - row.top_asr_pct;
                return (
                  <button
                    key={row.agent}
                    type="button"
                    onClick={() =>
                      setExpandedAgent(expanded ? null : row.agent)
                    }
                    aria-expanded={expanded}
                    className="text-left rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors flex flex-col gap-3 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] xl:w-[calc(20%-0.8rem)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-semibold text-foreground">
                          {AGENT_LABELS[row.agent] ?? row.agent}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {expanded ? t("Hide", "접기") : t("Details", "자세히")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("Top family", "최다 선택 계열")}
                    </div>
                    <div
                      className="text-base font-semibold leading-tight"
                      style={{ color }}
                    >
                      <abbr
                        title={FAMILY_FULLNAME[row.top_family] ?? row.top_family}
                        className="no-underline decoration-dotted underline underline-offset-2 cursor-help"
                        style={{ textDecorationColor: `${color}66` }}
                      >
                        {FAMILY_LABELS[row.top_family] ?? row.top_family}
                      </abbr>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-1 border-t border-border/60">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Selᵢ
                        </div>
                        <div className="text-foreground">
                          {row.top_sel_pct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          ASRᵢ
                        </div>
                        <div className="text-foreground">
                          {row.top_asr_pct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          TPS
                        </div>
                        <div className="text-foreground">
                          {formatTps(row.tps)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-[11px] font-mono ${
                        gap >= 8
                          ? "text-amber-600 dark:text-amber-400"
                          : gap <= -8
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {t("Gap", "격차")}: {gap >= 0 ? "+" : ""}
                      {gap.toFixed(1)} {t("pts", "포인트")}
                    </div>
                    <div
                      className={`text-xs leading-snug text-muted-foreground transition-all overflow-hidden ${
                        expanded
                          ? "max-h-40 opacity-100 mt-1"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      {decouplingInterpretation(row, lang)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </FadeIn>
    </>
  );
}

export function L2AsrHeatmap({ data }: { data: PaperSummary }) {
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <AsrPerFamilyHeatmap data={data} />
          </section>
        </FadeIn>
    </>
  );
}

export function L2Temporal({ data }: { data: PaperSummary }) {
  return (
    <>
        {data.temporal_adaptation && data.temporal_adaptation.length > 0 && (
          <FadeIn>
            <section className="max-w-[800px] mx-auto px-4 sm:px-6">
              <TemporalAdaptationBar data={data.temporal_adaptation} />
            </section>
          </FadeIn>
        )}
    </>
  );
}
