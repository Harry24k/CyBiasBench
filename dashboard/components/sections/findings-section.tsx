"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { FadeIn } from "@/components/fade-in";
import type { PaperSummary } from "@/lib/types";
import { Layer1Observation } from "./layer1-observation";
import { Layer2Decoupling } from "./layer2-decoupling";
import { Layer3Injection } from "./layer3-injection";

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

export function FindingsSection({ data }: { data: PaperSummary }) {
  const t = useT();
  const h = data.headline_stats;

  // Three cards correspond 1:1 to the paper's three layers of findings:
  //  - §4 Bias Observation       → Layer1 (#findings-layer1)
  //  - §4 Selection ≠ Performance → Layer2 (#findings-layer2)
  //  - §5 Bias Injection          → Layer3 (#findings-layer3)
  const KEY_FINDINGS = [
    {
      stat: `η² = ${h.kruskal_H.eta2.toFixed(2)}`,
      label: t("Attack-selection bias is agent-specific", "공격 선택 편향은 에이전트별로 고유함"),
      desc: t(
        `Each agent has a distinct allocation profile across the 10 attack families that persists across all four prompt conditions (Kruskal–Wallis on H(X), p = ${formatP(h.kruskal_H.p)}). A random forest identifies the producing agent at ${((h.rf_accuracy ?? 0.65) * 100).toFixed(0)}% accuracy from the selection vector alone.`,
        `에이전트별로 10종 공격 계열에 대한 배분 프로파일이 상이하며, 그 차이는 네 가지 프롬프트 조건 전체에서 유지됨 (H(X)에 대한 Kruskal–Wallis, p = ${formatP(h.kruskal_H.p)}). 랜덤 포레스트는 선택 벡터만으로 해당 에이전트를 ${((h.rf_accuracy ?? 0.65) * 100).toFixed(0)}% 정확도로 식별함.`
      ),
      sample: t("180 free-choice sessions", "자유 선택 세션 180회"),
      tone: "bias" as const,
      href: "#findings-layer1",
      cta: t("See Bias Observation →", "편향 관찰 보기 →"),
    },
    {
      stat: "Selᵢ ⊥ ASRᵢ",
      label: t("Selection ≠ Performance", "선택 ≠ 성능"),
      desc: t(
        `What an agent picks does not track what works. Codex allocates 31.5% to info_disclosure but achieves only 22.1% ASRᵢ on it. Across-agent effect sizes confirm structural metrics (η²(H)=${h.kruskal_H.eta2.toFixed(2)}) separate agents far more strongly than session ASR (η²=${h.kruskal_session_asr.eta2.toFixed(2)}).`,
        `에이전트가 선택하는 계열과 실제로 성과를 내는 계열은 서로 일치하지 않음. Codex는 info_disclosure에 31.5%를 배분하나 해당 계열의 ASRᵢ는 22.1%에 그침. 에이전트 간 효과크기 비교 시 구조적 지표(η²(H)=${h.kruskal_H.eta2.toFixed(2)})가 세션 ASR(η²=${h.kruskal_session_asr.eta2.toFixed(2)})보다 훨씬 강하게 에이전트를 구분함.`
      ),
      sample: t("structural ≫ outcome", "구조 지표 ≫ 결과 지표"),
      tone: "performance" as const,
      href: "#findings-layer2",
      cta: t("See decoupling →", "비결합 보기 →"),
    },
    {
      stat: t("No aggregate ASR gain", "전체 평균 ASR 개선 없음"),
      label: t("Bias momentum: steering fails to help", "편향 관성: 지시에도 개선되지 않음"),
      desc: t(
        `Under explicit family steering, compliance is associated with free-choice allocation (ρ = +${h.compliance_sel.rho.toFixed(3)}), while its association with per-family ASR is not significant (ρ = ${h.compliance_asri.rho.toFixed(3)}, under Bonferroni). Steering does not improve aggregate mean session ASR. Three individual-agent intervals include zero.`,
        `계열을 명시적으로 지시할 경우 순응도는 자유 선택 시의 배분과 연관됨 (ρ = +${h.compliance_sel.rho.toFixed(3)}). 계열별 ASR과의 상관은 유의하지 않음 (ρ = ${h.compliance_asri.rho.toFixed(3)}, Bonferroni 보정). 지시는 전체 평균 세션 ASR을 개선하지 않으며, 개별 에이전트 3종의 신뢰구간은 0을 포함함.`
      ),
      sample: t("450 bias-injection sessions", "편향 주입 세션 450회"),
      tone: "injection" as const,
      href: "#findings-layer3",
      cta: t("See Bias Injection →", "편향 주입 보기 →"),
    },
  ];

  return (
    <div className="space-y-24">
      <FadeIn>
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 space-y-6">
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              {t("Four metric axes used throughout the dashboard", "대시보드 전반에 사용되는 네 가지 지표 축")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <AxisLegend
                tone="bias"
                title={t("Bias Evaluation", "편향 평가")}
                metrics="H(X) · Selᵢ"
                question={t("How does the agent allocate effort?", "에이전트가 자원을 어디에 배분하는가?")}
                layer={t("Bias Observation", "편향 관찰")}
              />
              <AxisLegend
                tone="performance"
                title={t("Attack Performance", "공격 성능")}
                metrics="ASR · ASRᵢ"
                question={t("Does that allocation actually succeed?", "그 배분이 실제 성공으로 이어지는가?")}
                layer={t("Selection ≠ Performance · ASR transfer", "선택 ≠ 성능 · ASR 전이")}
              />
              <AxisLegend
                tone="efficiency"
                title={t("Efficiency & Robustness", "효율성과 견고성")}
                metrics="TPS · JSD"
                question={t("At what cost, and how stably across prompts?", "비용은 어느 정도이며, 프롬프트 변화에도 얼마나 안정적인가?")}
                layer={t("Prompt-stability JSD · Tokens per Success", "프롬프트 안정성 JSD · 성공당 토큰")}
              />
              <AxisLegend
                tone="injection"
                title={t("Bias Injection", "편향 주입")}
                metrics="C · ΔASR"
                question={t("Can prompt steering reshape the allocation?", "프롬프트 지시로 배분을 변경할 수 있는가?")}
                layer={t("Bias Injection setting", "편향 주입 설정")}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {KEY_FINDINGS.map((f) => (
              <a
                key={f.label}
                href={f.href}
                className={`group flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 border-t-4 transition-colors hover:bg-muted/40 ${
                  f.tone === "bias"
                    ? "border-t-indigo-500/70"
                    : f.tone === "performance"
                    ? "border-t-emerald-500/70"
                    : "border-t-rose-500/60"
                }`}
              >
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-foreground">
                  {f.stat}
                </span>
                <p className="text-sm font-semibold text-foreground mt-2">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground/80">
                    {f.sample}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                    {f.cta}
                  </span>
                </div>
              </a>
            ))}
          </div>

          <SynthesisCard />
        </div>
      </FadeIn>

      <Layer1Observation data={data} />
      <Layer2Decoupling data={data} />
      <Layer3Injection data={data} />
    </div>
  );
}

function SynthesisCard() {
  const t = useT();
  // Three separable behavioral axes — selection, performance, momentum.
  const COLUMNS = [
    {
      key: "allocation",
      tone: "bias" as const,
      title: t("Strategy selection", "전략 선택"),
      metrics: "H(X) · Selᵢ",
      ref: t("Bias Observation", "편향 관찰"),
      blurb: t("What an agent chooses to attack.", "무엇을 공격할지 선택하는 문제임."),
      detail: t(
        "Each agent's allocation profile across the 10 attack families is agent-specific and largely prompt-stable. Single-condition ASR underdescribes agent behavior because the structural attack-selection metrics separate agents an order of magnitude more strongly than session ASR (η²(H)=0.43 vs η²(ASR)=0.05).",
        "10종 공격 계열에 대한 배분 프로파일은 에이전트별로 고유하며 프롬프트가 변경되어도 대체로 유지됨. 구조적 공격 선택 지표가 세션 ASR보다 한 자릿수 강하게 에이전트를 구분하므로(η²(H)=0.43 vs η²(ASR)=0.05), 단일 조건 ASR만으로는 행동을 충분히 설명할 수 없음."
      ),
    },
    {
      key: "performance",
      tone: "performance" as const,
      title: t("Attack performance", "공격 성능"),
      metrics: "ASR · ASRᵢ",
      ref: t("Selection ≠ Performance", "선택 ≠ 성능"),
      blurb: t("Whether those attacks actually succeed.", "해당 공격이 실제로 성공하는지의 문제임."),
      detail: t(
        "Per-family attack performance ASRᵢ is a stable property of each agent: it transfers cleanly from free-choice to bias-injection settings (ρ = +0.702, p = 1.38×10⁻⁸). Capability and selection vary independently — the agent that selects a family most often is rarely the one that succeeds on it most often.",
        "계열별 공격 성능 ASRᵢ는 에이전트의 안정적 특성임. 자유 선택 설정에서 편향 주입 설정으로 그대로 전이됨(ρ = +0.702, p = 1.38×10⁻⁸). 실력과 선택은 상호 독립적이며, 최다 선택 계열이 최고 성과 계열인 경우는 드묾."
      ),
    },
    {
      key: "momentum",
      tone: "injection" as const,
      title: t("Bias momentum", "편향 관성"),
      metrics: t("Compliance · ΔASR", "순응도 · ΔASR"),
      ref: t("Bias Injection", "편향 주입"),
      blurb: t("How free-choice allocation relates to steering compliance.", "자유 선택 시의 배분이 지시 순응도와 어떻게 연관되는지의 문제임."),
      detail: t(
        "Under explicit family-level steering, compliance is associated with free-choice allocation (ρ = +0.529), while its association with per-family ASR is not significant (ρ = −0.248, under Bonferroni). Steering does not improve aggregate mean session ASR. These associations do not isolate intrinsic preference or establish the cause of the ASR change.",
        "계열을 명시적으로 지시할 경우 순응도는 자유 선택 시의 배분과 연관되며(ρ = +0.529), 계열별 ASR과의 상관은 유의하지 않음(ρ = −0.248, Bonferroni 보정). 지시는 전체 평균 세션 ASR을 개선하지 않음. 이 연관성만으로 내재적 선호를 분리하거나 ASR 변화의 원인을 확정할 수는 없음."
      ),
    },
  ];
  const [open, setOpen] = useState(false);

  return (
    <section id="findings-synthesis" className="relative scroll-mt-24 rounded-xl border border-border bg-gradient-to-br from-card via-card to-indigo-500/[0.04] dark:to-indigo-400/[0.05] p-6 space-y-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/60 via-emerald-500/60 to-rose-500/60"
      />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {t("Synthesis", "종합")}
          </p>
          <h3 className="font-serif text-2xl text-foreground mt-1">
            {t("Three separable behavioral axes", "분리 가능한 세 가지 행동 축")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t(
              "Strategy selection, attack performance, and bias momentum each decouple from the others. Outcome-only benchmarks compress these distinct axes into one number; CyBiasBench measures them independently.",
              "전략 선택, 공격 성능, 편향 관성은 상호 독립적으로 작동함. 결과만을 평가하는 벤치마크는 이 세 축을 단일 수치로 축약하나, CyBiasBench는 각각을 개별적으로 측정함."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer self-start"
          aria-expanded={open}
        >
          <span>{open ? t("Hide details", "자세히 접기") : t("Read details", "자세히 보기")}</span>
          <span className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(({ key, ...col }) => (
          <SynthesisColumn key={key} expanded={open} {...col} />
        ))}
      </div>
    </section>
  );
}

function SynthesisColumn({
  tone,
  title,
  metrics,
  ref,
  blurb,
  detail,
  expanded,
}: {
  tone: "bias" | "performance" | "injection";
  title: string;
  metrics: string;
  ref: string;
  blurb: string;
  detail: string;
  expanded: boolean;
}) {
  const accent =
    tone === "bias"
      ? "border-indigo-500/40"
      : tone === "performance"
      ? "border-emerald-500/40"
      : "border-rose-500/40";
  const dot =
    tone === "bias"
      ? "bg-indigo-500"
      : tone === "performance"
      ? "bg-emerald-500"
      : "bg-rose-500";
  const label =
    tone === "bias"
      ? "text-indigo-400"
      : tone === "performance"
      ? "text-emerald-400"
      : "text-rose-400";
  return (
    <div className={`rounded-lg border ${accent} bg-background/40 p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${label}`}>{title}</span>
      </div>
      <p className="text-xs font-mono text-muted-foreground">
        {metrics} <span className="text-muted-foreground/60">· {ref}</span>
      </p>
      <p className="text-sm text-foreground/90">{blurb}</p>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          <p className="text-xs text-muted-foreground leading-relaxed pt-2 mt-2 border-t border-border/60">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function AxisLegend({
  tone,
  title,
  metrics,
  question,
  layer,
}: {
  tone: "bias" | "performance" | "efficiency" | "injection";
  title: string;
  metrics: string;
  question: string;
  layer: string;
  href?: string;
}) {
  const dot =
    tone === "bias"
      ? "bg-indigo-500"
      : tone === "performance"
      ? "bg-emerald-500"
      : tone === "efficiency"
      ? "bg-amber-500"
      : "bg-rose-500";
  const label =
    tone === "bias"
      ? "text-indigo-400"
      : tone === "performance"
      ? "text-emerald-400"
      : tone === "efficiency"
      ? "text-amber-400"
      : "text-rose-400";
  return (
    <div className="block p-1 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${label}`}>{title}</span>
        <span className="text-xs font-mono text-muted-foreground">{metrics}</span>
      </div>
      <p className="text-xs italic text-muted-foreground">{question}</p>
      <p className="text-[11px] font-mono text-muted-foreground/70">{layer}</p>
    </div>
  );
}
