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
import { useT } from "@/lib/i18n";
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
  const t = useT();
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
          {t("Bias Injection", "편향 주입")}
        </h2>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl text-pretty">
          {t(
            <>
              Steering compliance is associated with free-choice allocation
              (ρ = +{h.compliance_sel.rho.toFixed(3)}), while its association with per-family ASR
              is not significant (ρ = {h.compliance_asri.rho.toFixed(3)}, under Bonferroni).
              We call this cross-setting association <strong className="text-foreground">bias momentum</strong>.
              It describes operational behavior conditioned by target availability and difficulty.
            </>,
            <>
              지시 순응도는 자유 선택 시의 배분과 연관되며
              (ρ = +{h.compliance_sel.rho.toFixed(3)}), 계열별 ASR과의 상관은 유의하지 않음
              (ρ = {h.compliance_asri.rho.toFixed(3)}, Bonferroni 보정).
              이 설정 간 연관성을 <strong className="text-foreground">편향 관성(bias momentum)</strong>으로 명명함.
              이는 표적의 취약점 가용성과 난이도에 영향을 받는 운영상의 행동을 설명함.
            </>
          )}
        </p>
      </header>

      <FadeIn>
        <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground">
              {t("Bias Injection design", "편향 주입 설계")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "Requested-family condition. The environment, tool access, and verification pipeline remain identical to Bias Observation; only the task focus statement names a target family.",
                "계열 지정 조건임. 환경, 도구 접근, 검증 파이프라인은 편향 관찰과 완전히 동일하며, 과제 진술문에서 목표 계열을 지정하는 부분만 상이함."
              )}
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
                {t("Observation vs Injection session ASR per agent", "에이전트별 관찰 vs 주입 세션 ASR")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  "Side-by-side observation and forced-injection session ASR for each agent. Hover for raw obs/inj, ΔASR, compliance, and per-agent injection session count.",
                  "에이전트별 관찰 세션 ASR과 강제 주입 세션 ASR을 병렬 비교함. 마우스를 올리면 원값(obs/inj), ΔASR, 순응도, 에이전트별 주입 세션 수가 표시됨."
                )}
              </p>
            </div>
            <span className="text-xs font-mono tracking-wide text-foreground px-2 py-1 rounded border border-foreground/30 bg-muted">
              {t("Agent-equal mean ΔASR", "에이전트 균등 평균 ΔASR")} {data.session_asr_uncertainty.estimates.agent_equal_mean.delta.toFixed(4)}
            </span>
          </div>
          <ObsInjBars bars={obsInjBars} />
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              {t("ΔASR per agent", "에이전트별 ΔASR")}
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
          <SessionAsrUncertainty data={data} />
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
              {t("Per-family ASR transfer (observation → injection)", "계열별 ASR 전이 (관찰 → 주입)")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                <>
                  Observation per-family ASR<sub>i</sub> vs injection per-family ASR<sub>i</sub> under forced
                  injection. The strong positive correlation
                  (ρ = +{h.asr_transfer.rho.toFixed(3)}, p = {formatP(h.asr_transfer.p)})
                  confirms capability persists across prompt conditions and forcing.
                </>,
                <>
                  관찰 설정의 계열별 ASR<sub>i</sub>와 강제 주입 설정의 계열별 ASR<sub>i</sub>를
                  비교함. 강한 양의 상관
                  (ρ = +{h.asr_transfer.rho.toFixed(3)}, p = {formatP(h.asr_transfer.p)})은
                  프롬프트 조건 및 강제 지시가 변경되어도 실력이 유지됨을 나타냄.
                </>
              )}
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
              {t("Per-agent injection summary", "에이전트별 주입 요약")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "Compliance, observed/injected session ASR, and ΔASR by agent. Sorted by estimated ΔASR ascending.",
                "에이전트별 순응도, 관찰/주입 세션 ASR, ΔASR임. 추정 ΔASR의 오름차순으로 정렬함."
              )}
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
                {t("Synthesis · §5–7", "종합 · §5–7")}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {t("Three separable axes", "분리 가능한 세 가지 축")}
              </span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-foreground leading-tight">
              {t(
                "Allocation, attack performance, and bias momentum are distinct axes.",
                "배분, 공격 성능, 편향 관성은 서로 다른 축임."
              )}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {t(
                <>
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
                  (<Stat>ρ = {h.compliance_asri.rho.toFixed(3)}</Stat>, n.s.) — free-choice allocation remains associated with steering compliance, a phenomenon we term{" "}
                  <strong className="text-foreground">bias momentum</strong>. Per-family ASR itself transfers
                  cleanly across settings (<Stat>ρ = +{h.asr_transfer.rho.toFixed(3)}</Stat>,{" "}
                  <Stat>{formatP(h.asr_transfer.p)}</Stat>). These associations do not isolate intrinsic preference or establish the cause of the ASR change.
                </>,
                <>
                  프런티어 에이전트 5종, 표적 환경 3종, 총 630회 세션에 걸쳐 공격 선택 편향은{" "}
                  <strong className="text-foreground">안정적이고, 에이전트별로 고유하며, 프롬프트에 둔감함</strong>.
                  행동의 이질성(
                  <Stat>η²<sub>H(X)</sub> = {h.kruskal_H.eta2.toFixed(3)}</Stat>,{" "}
                  <Stat>{formatP(h.kruskal_H.p)}</Stat>)이 결과의 이질성(
                  <Stat>η²<sub>ASR</sub> = {h.kruskal_session_asr.eta2.toFixed(3)}</Stat>)을 한 자릿수 차이로 상회함.
                  편향 주입 하에서 순응도는 자유 선택 시의 선택
                  (<Stat>ρ = +{h.compliance_sel.rho.toFixed(3)}</Stat>,{" "}
                  <Stat>{formatP(h.compliance_sel.p)}</Stat>)을 따르며, 계열별 실력
                  (<Stat>ρ = {h.compliance_asri.rho.toFixed(3)}</Stat>, 유의하지 않음)은 <em>따르지 않음</em>.
                  자유 선택 시의 배분이 지시 순응도와 연관되는 이 현상을{" "}
                  <strong className="text-foreground">편향 관성</strong>이라 명명함. 계열별 ASR 자체는
                  설정이 변경되어도 온전히 전이되므로(<Stat>ρ = +{h.asr_transfer.rho.toFixed(3)}</Stat>,{" "}
                  <Stat>{formatP(h.asr_transfer.p)}</Stat>). 이러한 연관성만으로 내재적 선호나 ASR 변화의 원인을 확정할 수는 없음.
                </>
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
              <Takeaway
                tag={t("What stays", "유지되는 것")}
                body={t(
                  "Per-family capability transfers; what an agent does well, it keeps doing well across regimes.",
                  "계열별 실력은 전이됨. 성과가 우수하던 계열은 설정이 변경되어도 지속적으로 우수함."
                )}
              />
              <Takeaway
                tag={t("What doesn't", "유지되지 않는 것")}
                body={t(
                  "Compliance is associated with free-choice allocation. Steering does not improve aggregate mean session ASR.",
                  "순응도는 자유 선택 시의 배분과 연관됨. 지시는 전체 평균 세션 ASR을 개선하지 않음."
                )}
              />
              <Takeaway
                tag={t("What that means for evaluation", "평가에 주는 함의")}
                body={t(
                  "Outcome-only benchmarks compress distinct strategies into one number. Allocation, attack performance, and bias momentum must be measured as separable axes.",
                  "결과만을 평가하는 벤치마크는 상이한 전략을 단일 수치로 축약함. 배분, 공격 성능, 편향 관성은 분리된 축으로 측정하여야 함."
                )}
              />
            </div>
          </div>
        </section>
      </FadeIn>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6">
        <BridgeText>
          {t(
            "Free-choice allocation remains associated with steering compliance. Steering does not improve aggregate mean session ASR.",
            "자유 선택 시의 배분과 지시 순응도의 연관성이 유지됨. 지시는 전체 평균 세션 ASR을 개선하지 않음."
          )}
        </BridgeText>
      </div>
    </div>
  );
}

function SessionAsrUncertainty({ data }: { data: PaperSummary }) {
  const t = useT();
  const uncertainty = data.session_asr_uncertainty;
  const rows = [...data.agents, "agent_equal_mean"];
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}`;
  return (
    <div className="mt-5 rounded-lg border border-border bg-card p-4">
      <h4 className="text-sm font-semibold text-foreground">
        {t("Mean session ASR change and 95% confidence intervals", "평균 세션 ASR 변화와 95% 신뢰구간")}
      </h4>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
        {t(
          "Steering does not improve aggregate mean session ASR. Three individual-agent intervals include zero. Intervals use 20,000 session-bootstrap draws and the original automatic success labels. They do not establish a uniform individual-agent decrease or a causal bias-momentum effect.",
          "지시는 전체 평균 세션 ASR을 개선하지 않으며, 개별 에이전트 3종의 구간은 0을 포함함. 원래 자동 성공 판정에 기반한 20,000회 세션 부트스트랩 구간이며, 모든 에이전트의 일관된 감소나 편향 관성의 인과 효과를 입증하지는 않음."
        )}
      </p>
      <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow>
          <TableHead>{t("Agent", "에이전트")}</TableHead>
          <TableHead className="text-right">ΔASR</TableHead>
          <TableHead className="text-right">95% CI</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((agent) => {
            const row = uncertainty.estimates[agent];
            return (
              <TableRow key={agent} className={agent === "agent_equal_mean" ? "font-semibold" : ""}>
                <TableCell>{agent === "agent_equal_mean" ? t("Agent-equal mean", "에이전트 균등 평균") : AGENT_LABELS[agent]}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{signed(row.delta)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">[{signed(row.ci95[0])}, {signed(row.ci95[1])}]</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
      <div className="sm:hidden mt-3 divide-y divide-border">
        {rows.map((agent) => {
          const row = uncertainty.estimates[agent];
          return (
            <div key={agent} className={`py-2 text-xs ${agent === "agent_equal_mean" ? "font-semibold" : ""}`}>
              <div className="flex justify-between gap-2">
                <span>{agent === "agent_equal_mean" ? t("Agent-equal mean", "에이전트 균등 평균") : AGENT_LABELS[agent]}</span>
                <span className="font-mono tabular-nums">ΔASR {signed(row.delta)}</span>
              </div>
              <p className="mt-1 text-right font-mono tabular-nums text-muted-foreground">
                95% CI [{signed(row.ci95[0])}, {signed(row.ci95[1])}]
              </p>
            </div>
          );
        })}
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
  const t = useT();
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
              value: t("Session ASR (%)", "세션 ASR (%)"),
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
                    {t("obs ASR", "관찰 ASR")}: {row.obs.toFixed(2)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("inj ASR", "주입 ASR")}: {row.inj.toFixed(2)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    ΔASR: {row.delta >= 0 ? "+" : ""}
                    {row.delta.toFixed(2)} pp
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("compliance", "순응도")}: {row.compliance.toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums text-muted-foreground">
                    {t("Injection sessions", "주입 세션 수")}: {row.sessions}
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="obs" name={t("Observation ASR", "관찰 ASR")} radius={[4, 4, 0, 0]} fill="#94a3b8">
            {bars.map((b) => (
              <Cell key={`obs-${b.agent}`} fill={b.color} fillOpacity={0.45} />
            ))}
          </Bar>
          <Bar dataKey="inj" name={t("Injection ASR", "주입 ASR")} radius={[4, 4, 0, 0]} fill="#0f172a">
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
  const t = useT();
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
              value: t("Δ session ASR (pp)", "Δ 세션 ASR (pp)"),
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
  const t = useT();
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
          {t("Compliance predictors", "순응도 예측 요인")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Each point is one (agent, family) cell. Compliance is associated with free-choice Selᵢ, while its association with ASRᵢ is not significant under Bonferroni. Reported correlations standardize within agents before pooling. Use the chips to filter agents and families.",
            "각 점은 (에이전트, 계열) 셀 1개임. 순응도는 자유 선택 시 Selᵢ와 연관되며, ASRᵢ와의 상관은 Bonferroni 보정 후 유의하지 않음. 보고된 상관은 에이전트별 표준화 후 통합하여 계산함. 칩으로 에이전트와 계열을 필터링할 수 있음."
          )}
        </p>
      </div>

      <FilterChips
        title={t("Agents", "에이전트")}
        items={agents}
        labelMap={AGENT_LABELS}
        selected={selectedAgents}
        onToggle={toggleAgent}
        onAll={selectAllAgents}
      />
      <FilterChips
        title={t("Families", "계열")}
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
          {t(
            "Show regression line (linear fit on filtered points)",
            "회귀선 표시 (필터링된 점에 대한 선형 적합)"
          )}
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          n = {filtered.length} / {predictors.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PredictorPanel
          title={t("Selᵢ (observation) vs Compliance", "Selᵢ (관찰) vs 순응도")}
          xKey="sel_i"
          xLabel={t("Selection rate Selᵢ", "선택률 Selᵢ")}
          data={filtered}
          rho={rhoSel}
          pValue={pSel}
          xFormat={(v) => `${(v * 100).toFixed(0)}%`}
          showRegression={showRegression}
        />
        <PredictorPanel
          title={t("ASRᵢ (observation) vs Compliance", "ASRᵢ (관찰) vs 순응도")}
          xKey="asr_i"
          xLabel={t("Per-family ASRᵢ", "계열별 ASRᵢ")}
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
  const t = useT();
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
          {t("Reset", "초기화")}
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
  const t = useT();
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
              value: t("Compliance (injection)", "순응도 (주입)"),
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
                    {t("ASRᵢ (obs)", "ASRᵢ (관찰)")}: {(row.asr_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("target ASR (inj)", "목표 ASR (주입)")}: {(row.asr_i_s2 * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("compliance", "순응도")}: {(row.compliance * 100).toFixed(1)}%
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
  const t = useT();
  return (
    <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-5 space-y-3 self-start">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
          {t("Gemini exception", "Gemini 예외")}
        </span>
      </div>
      <p className="text-sm text-foreground font-semibold leading-snug">
        {t(
          "Cross-setting transfer is significant for 4 of 5 agents — Gemini is the lone outlier.",
          "설정 간 전이는 5종 중 4종 에이전트에서 유의함. Gemini만 예외임."
        )}
      </p>
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        {t(
          <>
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
              align with where it&apos;s already capable — preference and ability are
              partially fused only for the most peaked allocator.
            </p>
          </>,
          <>
            <p>
              전체: <span className="font-mono text-foreground">ρ = +0.696</span>{" "}
              <span className="font-mono">(p = 1.96×10⁻⁸, n = 50)</span>.{" "}
              에이전트별 (n=10):
            </p>
            <ul className="space-y-1 font-mono">
              <li>· Claude / Codex / GLM / Kimi: p &lt; 0.05에서 유의</li>
              <li>· Gemini: <span className="text-foreground">ρ = +0.122, 유의하지 않음</span></li>
            </ul>
            <p className="pt-2 border-t border-border/60">
              다만 Gemini 내부에서는 순응도가 목표 한정 ASR과 상관을 보임
              (<span className="font-mono text-foreground">ρ = +0.696, p = 0.025</span>).
              자유 선택 프로파일이 특정 계열에 크게 편중되어 있어, 지시받은 방향이 이미
              성과가 우수한 영역과 결과적으로 일치하는 것임. 배분이 가장 집중된
              에이전트에 한하여 선호와 실력이 부분적으로 결합되어 있음.
            </p>
          </>
        )}
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
  const t = useT();
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
          {t("Per-family ASR transfer (observation → injection)", "계열별 ASR 전이 (관찰 → 주입)")}
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
              value: t("Observation per-family ASRᵢ", "관찰 계열별 ASRᵢ"),
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
              value: t("Injection per-family ASRᵢ (forced)", "주입 계열별 ASRᵢ (강제)"),
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
                    {t("Obs ASRᵢ", "관찰 ASRᵢ")}: {(row.asr_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("Inj ASRᵢ", "주입 ASRᵢ")}: {(row.asr_i_s2 * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    Selᵢ: {(row.sel_i * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums">
                    {t("compliance", "순응도")}: {(row.compliance * 100).toFixed(1)}%
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
  const t = useT();
  // Compliance → session ASR is reported in the paper Table but is not exposed
  // in headline_stats; values are taken from the published Table.
  const COMPLIANCE_SESSION_ASR = { rho: -0.082, p: 0.573, n: 50 };

  const rows: { label: string; rho: number; p: number; n: number }[] = [
    {
      label: t("Sel → compliance", "Sel → 순응도"),
      rho: h.compliance_sel.rho,
      p: h.compliance_sel.p,
      n: h.compliance_sel.n,
    },
    {
      label: t("ASRᵢ → compliance", "ASRᵢ → 순응도"),
      rho: h.compliance_asri.rho,
      p: h.compliance_asri.p,
      n: h.compliance_asri.n,
    },
    {
      label: t("ASRᵢ → target ASR", "ASRᵢ → 목표 ASR"),
      rho: h.asr_transfer.rho,
      p: h.asr_transfer.p,
      n: h.asr_transfer.n,
    },
    {
      label: t("Compliance → session ASR", "순응도 → 세션 ASR"),
      rho: COMPLIANCE_SESSION_ASR.rho,
      p: COMPLIANCE_SESSION_ASR.p,
      n: COMPLIANCE_SESSION_ASR.n,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {t("Bias-injection correlations", "편향 주입 상관관계")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Spearman ρ across the 50 (agent × family) cells under bias injection.",
            "편향 주입 하의 50개 (에이전트 × 계열) 셀에 대한 Spearman ρ임."
          )}
        </p>
      </div>
      <div className="mt-4 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">{t("Relationship", "관계")}</TableHead>
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
  const t = useT();
  const sorted = [...rows].sort((a, b) => a.delta - b.delta);
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      {/* Desktop: full table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">{t("Agent", "에이전트")}</TableHead>
              <TableHead className="text-foreground text-right">{t("obs ASR", "관찰 ASR")}</TableHead>
              <TableHead className="text-foreground text-right">{t("inj ASR", "주입 ASR")}</TableHead>
              <TableHead className="text-foreground text-right">ΔASR</TableHead>
              <TableHead className="text-foreground text-right">{t("compliance", "순응도")}</TableHead>
              <TableHead className="text-foreground text-right">{t("sessions", "세션 수")}</TableHead>
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
                {t(`${r.sessions} sessions`, `세션 ${r.sessions}회`)}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono tabular-nums">
              <PerAgentStat label={t("obs ASR", "관찰 ASR")} value={`${r.obs.toFixed(2)}%`} />
              <PerAgentStat label={t("inj ASR", "주입 ASR")} value={`${r.inj.toFixed(2)}%`} />
              <PerAgentStat
                label="ΔASR"
                value={`${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} pp`}
              />
              <PerAgentStat label={t("compliance", "순응도")} value={`${r.compliance.toFixed(1)}%`} />
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
