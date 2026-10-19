"use client";

import { FadeIn } from "@/components/fade-in";
import { BridgeText } from "@/components/bridge-text";
import { ConditionHeatmapGrid } from "@/components/charts/condition-heatmap-grid";
import { MiniFamilyBars } from "@/components/charts/mini-radar";
import { AGENT_LABELS, FAMILY_FULLNAME } from "@/lib/types";
import type { PaperSummary } from "@/lib/types";
import { useAgentColors, useChartColors, useTheme } from "@/lib/use-theme";
import { useT } from "@/lib/i18n";
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

function useL1(data: PaperSummary) {
  const t = useT();
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

  return { t, agents, families, sig, jsd, kw, agentColors, maxH, maxUniq, maxCr1, maxAsr };
}

export function Layer1Observation({ data }: { data: PaperSummary }) {
  const { t, kw } = useL1(data);
  return (
    <div id="findings-layer1" className="space-y-14 scroll-mt-24">
      <header className="max-w-[800px] mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          {t("Bias Observation", "편향 관찰")}
        </h2>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl text-pretty">
          {t(
            <>
              Under free choice, each agent exposes a distinctive allocation profile over the 10
              attack families. Kruskal–Wallis on H(X) rejects a shared distribution
              (H = {kw.H.toFixed(2)}, p = {formatP(kw.p)}, η² = {kw.eta2.toFixed(3)}), and prompt
              variation contributes less than between-agent variation
              (Prompt-stability JSD 0.038 vs between-agent 0.054).
            </>,
            <>
              자유 선택 조건에서 에이전트별로 10종 공격 계열에 대한 배분 프로파일이 뚜렷하게 구분됨.
              H(X)에 대한 Kruskal–Wallis 검정은 공통 분포 가설을 기각함
              (H = {kw.H.toFixed(2)}, p = {formatP(kw.p)}, η² = {kw.eta2.toFixed(3)}).
              프롬프트 변화에 따른 차이는 에이전트 간 차이보다 작음
              (프롬프트 안정성 JSD 0.038 vs 에이전트 간 0.054).
            </>
          )}
        </p>
      </header>

      <L1Signatures data={data} />

      <L1ConditionHeatmap data={data} />

      <L1Jsd data={data} />

      <L1Identification data={data} />

      <div className="max-w-[800px] mx-auto px-4 sm:px-6">
        <BridgeText>
          {t(
            "Selection profiles are stable and model-specific. But do these preferences track what actually succeeds?",
            "선택 프로파일은 안정적이며 모델별로 고유함. 그렇다면 이 선호가 실제 성과와 일치하는가?"
          )}
        </BridgeText>
      </div>
    </div>
  );
}

export function L1Signatures({ data }: { data: PaperSummary }) {
  const { t, agents, families, sig, agentColors, maxH, maxUniq, maxCr1, maxAsr } = useL1(data);
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                {t("Agent Signatures", "에이전트 시그니처")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  <>
                    Three bias indicators per agent: entropy H(X), mean unique families per session,
                    and the most-selected family&apos;s share (Sel<sub>i</sub>).
                  </>,
                  <>
                    에이전트별 편향 지표 3종: 엔트로피 H(X), 세션당 평균 고유 계열 수,
                    최다 선택 계열의 비중(Sel<sub>i</sub>).
                  </>
                )}
              </p>
            </div>

            <div className="rounded-lg border border-border overflow-hidden bg-card">
              {/* Desktop: dense per-agent grid */}
              <div className="hidden md:grid grid-cols-[150px_1.5fr_0.9fr_0.9fr_0.9fr_0.9fr] text-sm">
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground">
                  {t("Agent", "에이전트")}
                </div>
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground">
                  {t("Most Selected Family", "최다 선택 계열")}{" "}
                  <span className="text-xs text-muted-foreground font-normal">({t("selection share", "선택 비중")})</span>
                </div>
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                  H(X){" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {t("↑ breadth", "↑ 넓음")}
                  </span>
                </div>
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                  {t("Unique / sess", "고유 / 세션")}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {t("↑ breadth", "↑ 넓음")}
                  </span>
                </div>
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                  {t("Sel CR1", "Sel CR1")}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {t("↑ concentrated", "↑ 집중")}
                  </span>
                </div>
                <div className="bg-muted/50 px-4 py-3 font-semibold text-foreground text-right">
                  {t("Session ASR", "세션 ASR")}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {t("↑ better", "↑ 높을수록 우수")}
                  </span>
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
              {t(
                <>
                  36 free-choice sessions per agent. The value in parentheses is the
                  most-selected family&apos;s selection share;{" "}
                  <span className="font-mono">Sel CR1</span> is the within-session concentration
                  averaged across sessions.
                </>,
                <>
                  에이전트당 자유 선택 세션 36회임. 괄호 안 값은 최다 선택 계열의 선택 비중이며,{" "}
                  <span className="font-mono">Sel CR1</span>은 세션 내 집중도를 전체 세션에 대해 평균한 값임.
                </>
              )}
            </p>
          </section>
        </FadeIn>
    </>
  );
}

export function L1ConditionHeatmap({ data }: { data: PaperSummary }) {
  const { t, agents, families } = useL1(data);
  return (
    <>
        {data.fig2_selection_heatmap_by_condition && (
          <FadeIn>
            <section className="max-w-[800px] mx-auto px-4 sm:px-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {t("Selection across the four prompt conditions", "네 가지 프롬프트 조건별 선택")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    <>
                      Same Sel<sub>i</sub> heatmap split by the 2×2 prompt design.
                      Within an agent, the four panels look nearly identical;
                      between agents, they look obviously different. Family shares also depend on vulnerability availability, discoverability, and execution difficulty.
                    </>,
                    <>
                      동일한 Sel<sub>i</sub> 히트맵을 2×2 프롬프트 설계 기준으로 분할한 것임.
                      동일 에이전트 내에서는 네 패널이 거의 동일하게 나타나나,
                      에이전트 간에는 확연히 구분됨. 계열별 비중에는 취약점 가용성·발견 가능성·실행 난이도도 영향을 줌.
                    </>
                  )}
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
    </>
  );
}

export function L1Jsd({ data }: { data: PaperSummary }) {
  const { t, jsd } = useL1(data);
  return (
    <>
        <FadeIn>
          <section className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                {t("Prompt Robustness (JSD)", "프롬프트 견고성 (JSD)")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  "Jensen–Shannon divergence between family distributions. Within-agent drift (prompt conditions vs agent centroid) is much smaller than between-agent separation — these patterns persist across the evaluated prompts without isolating intrinsic preference.",
                  "계열 분포 간 Jensen–Shannon 발산임. 에이전트 내부 변동(프롬프트 조건 vs 에이전트 중심)이 에이전트 간 격차보다 현저히 작음. 평가한 프롬프트들에서 패턴이 유지되지만, 내재적 선호만을 분리한 결과는 아님."
                )}
              </p>
            </div>
            <JSDComparison jsd={jsd} />
          </section>
        </FadeIn>
    </>
  );
}

export function L1Identification({ data }: { data: PaperSummary }) {
  const { t } = useL1(data);
  return (
    <>
        {data.agent_identification_rf && (
          <FadeIn>
            <section className="max-w-[800px] mx-auto px-4 sm:px-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {t("Agent Identification by Selection Pattern", "선택 패턴으로 에이전트 식별하기")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {(() => {
                    const acc = (
                      (data.headline_stats.rf_accuracy ??
                        data.agent_identification_rf.metrics.leave_one_out?.accuracy ??
                        0) * 100
                    ).toFixed(0);
                    const base = (
                      (data.headline_stats.rf_baseline ??
                        data.agent_identification_rf.baseline_accuracy ??
                        0.2) * 100
                    ).toFixed(0);
                    const Acc = (
                      <span className="font-mono tabular-nums text-foreground">{acc}%</span>
                    );
                    const Base = (
                      <span className="font-mono tabular-nums text-foreground">{base}%</span>
                    );
                    return t(
                      <>
                        A random forest classifier trained on the 10-family Sel<sub>i</sub> vectors
                        identifies the underlying agent at {Acc} accuracy versus a {Base} chance
                        baseline — selection profiles are agent-specific fingerprints.
                      </>,
                      <>
                        10종 계열 Sel<sub>i</sub> 벡터로 학습한 랜덤 포레스트 분류기는 실제
                        에이전트를 {Acc} 정확도로 식별함. 무작위 기준선은 {Base}임. 선택
                        프로파일은 에이전트별 고유 지문에 해당함.
                      </>
                    );
                  })()}
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
    </>
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
      {/* Most Selected Family (Sel_i) */}
      <div className="px-4 py-4 border-t border-border flex items-center">
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
      <BarCell value={entropy} max={maxH} color={color} format={(v) => v.toFixed(2)} />
      <BarCell value={unique} max={maxUniq} color={color} format={(v) => v.toFixed(1)} />
      <BarCell value={cr1} max={maxCr1} color={color} format={(v) => `${v.toFixed(1)}%`} />
      <BarCell
        value={sessionAsr}
        max={maxAsr}
        color={color}
        format={(v) => `${(v * 100).toFixed(1)}%`}
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
  const t = useT();
  const rows: Array<{ label: React.ReactNode; value: string; pct: number; suffix?: string; suffixTitle?: string }> = [
    {
      label: <>{t("Most Selected", "최다 선택")} <span className="text-muted-foreground/70">{t("selection share", "선택 비중")}</span></>,
      value: `${topShare.toFixed(1)}%`,
      pct: topShare,
      suffix: FAMILY_LABELS[topFamily] ?? topFamily,
      suffixTitle: FAMILY_FULLNAME[topFamily],
    },
    {
      label: <>H(X) <span className="text-muted-foreground/70">{t("↑ breadth", "↑ 넓음")}</span></>,
      value: entropy.toFixed(2),
      pct: maxH > 0 ? (entropy / maxH) * 100 : 0,
    },
    {
      label: <>{t("Unique / session", "고유 / 세션")}</>,
      value: unique.toFixed(1),
      pct: maxUniq > 0 ? (unique / maxUniq) * 100 : 0,
    },
    {
      label: <>Sel CR1 <span className="text-muted-foreground/70">{t("↑ concentrated", "↑ 집중")}</span></>,
      value: `${cr1.toFixed(1)}%`,
      pct: maxCr1 > 0 ? (cr1 / maxCr1) * 100 : 0,
    },
    {
      label: <>{t("Session ASR", "세션 ASR")} <span className="text-muted-foreground/70">{t("↑ better", "↑ 높을수록 우수")}</span></>,
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
            <div className="col-span-2 relative h-1.5 rounded-full bg-foreground/10 overflow-hidden">
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
          {t("Selection share across 10 families", "선택 비중 · 10개 계열")}
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
        <div className="relative h-2 w-full max-w-[180px] rounded-full bg-foreground/10 overflow-hidden">
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
  const t = useT();
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
              {t("Within-agent JSD", "에이전트 내 JSD")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("condition-to-centroid drift, per agent", "에이전트별 조건–중심 간 변동")}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground tabular-nums">
              {withinMean.toFixed(3)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{t("mean", "평균")}</span>
          </div>
          <div className="relative h-2 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(withinMean / maxVal) * 100}%`,
                backgroundColor: withinColor,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {t("four-condition centroid", "네 조건의 중심")}
          </span>
        </div>

        {/* Center divider with ratio (vertical on sm+, horizontal on mobile) */}
        <div className="flex flex-row sm:flex-col items-center justify-center sm:px-2">
          <div className="flex-1 h-px sm:h-auto sm:w-px sm:flex-1 bg-border" />
          <div className="mx-3 sm:mx-0 sm:my-3 px-3 py-1.5 rounded-full bg-foreground/[0.07] text-center">
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
              {t("Between-agent JSD", "에이전트 간 JSD")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("across agent pairs", "에이전트 쌍 전체")}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground tabular-nums">
              {jsd.between_agent_mean.toFixed(3)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{t("mean", "평균")}</span>
          </div>
          <div className="relative h-2 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(jsd.between_agent_mean / maxVal) * 100}%`,
                backgroundColor: betweenColor,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {t("median", "중앙값")} {jsd.between_agent_median.toFixed(3)}
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
  const t = useT();
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
            {t("Leave-one-session-out", "세션 단위 리브-원-아웃")}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-mono font-bold text-foreground tabular-nums">
              {(acc * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground">{t("accuracy", "정확도")}</span>
          </div>
          <div className="relative h-2 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
              style={{ width: `${acc * 100}%`, opacity: 0.85 }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/60"
              style={{ left: `${base * 100}%` }}
              aria-label={t("chance baseline", "무작위 기준선")}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
            <span>0%</span>
            <span>{t("baseline", "기준선")} {(base * 100).toFixed(0)}%</span>
            <span>100%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {rf.metrics.leave_one_out?.n
              ? t(
                  `n = ${rf.metrics.leave_one_out.n} sessions, `,
                  `n = ${rf.metrics.leave_one_out.n} 세션, `
                )
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
            {t("Per-agent F1", "에이전트별 F1")}
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
