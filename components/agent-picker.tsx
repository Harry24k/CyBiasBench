"use client";

import { useMemo, useState } from "react";
import { AGENT_LABELS, AGENT_MODELS, FAMILY_FULLNAME } from "@/lib/types";
import type { PaperSummary } from "@/lib/types";
import { useAgentColors } from "@/lib/use-theme";
import { useT } from "@/lib/i18n";

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

type Priority = "balanced" | "accuracy" | "efficiency";

const PRIORITY_LABELS_KO: Record<Priority, string> = {
  accuracy: "정확도",
  balanced: "균형",
  efficiency: "효율",
};

export function AgentPicker({ data }: { data: PaperSummary }) {
  const t = useT();
  const agents = data.agents;
  const families = data.families;
  const agentColors = useAgentColors();
  const [family, setFamily] = useState<string>("any");
  const [priority, setPriority] = useState<Priority>("balanced");

  const ranked = useMemo(() => {
    const tpsMap = data.tps_per_agent ?? {};
    const sigMap = data.table1_agent_signatures ?? {};
    const asriMap = data.fig3_asri_per_agent ?? {};
    const selMap = data.fig3_selection_per_agent ?? {};

    // For each agent, compute (asr, tps, sel) under the requested family.
    const rows = agents.map((a) => {
      const asr =
        family === "any"
          ? sigMap[a]?.session_asr_mean ?? 0
          : (asriMap[a]?.[family] ?? 0);
      const tps = tpsMap[a] ?? Number.POSITIVE_INFINITY;
      const sel =
        family === "any" ? null : (selMap[a]?.[family] ?? 0) * 100;
      return { agent: a, asr, tps, sel };
    });

    // Score: accuracy normalised vs max ASR; efficiency normalised vs min TPS.
    const maxAsr = Math.max(...rows.map((r) => r.asr), 1e-9);
    const minTps = Math.min(...rows.map((r) => r.tps));
    const scored = rows.map((r) => {
      const accScore = r.asr / maxAsr; // 0..1
      const effScore = r.tps > 0 ? minTps / r.tps : 0; // 0..1
      const score =
        priority === "accuracy"
          ? accScore
          : priority === "efficiency"
            ? effScore
            : 0.65 * accScore + 0.35 * effScore;
      return { ...r, score, accScore, effScore };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [agents, family, priority, data]);

  const familyFull =
    family === "any"
      ? t("any attack family", "모든 공격 계열")
      : (FAMILY_FULLNAME[family] ?? family);

  return (
    <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
      <div className="mb-4 sm:mb-6">
        <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {t("Try it", "직접 해보기")}
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          {t("Pick an agent for your task", "과제에 맞는 에이전트 고르기")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
          {t(
            "Filter by attack family and what you optimize for. Ranking is computed live from the observation-setting per-family ASR and tokens-per-success in this dashboard.",
            "공격 계열과 우선순위를 골라 보면 됨. 순위는 이 대시보드의 관찰 설정 계열별 ASR과 성공당 토큰으로 바로 계산됨."
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
          <label className="flex flex-col gap-1.5 flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {t("Attack family", "공격 계열")}
            </span>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
            >
              <option value="any">{t("Any (overall ASR)", "전체 (종합 ASR)")}</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {FAMILY_FULLNAME[f] ?? f} ({FAMILY_LABELS[f] ?? f})
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5 sm:flex-1">
            <legend className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              {t("Optimize for", "우선할 기준")}
            </legend>
            <div className="inline-flex rounded-md border border-border overflow-hidden self-start">
              {(["accuracy", "balanced", "efficiency"] as Priority[]).map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    i > 0 ? "border-l border-border" : ""
                  } ${
                    priority === p
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                  aria-pressed={priority === p}
                >
                  {t(p, PRIORITY_LABELS_KO[p])}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 sm:mt-6 space-y-2">
          {ranked.map((r, i) => {
            const color = agentColors[r.agent] ?? "#888";
            const isTop = i === 0;
            return (
              <div
                key={r.agent}
                className={`rounded-lg border bg-muted/30 px-3 sm:px-4 py-3 transition-colors ${
                  isTop ? "border-foreground/30 bg-muted/60" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono ${
                      isTop
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">
                      {AGENT_LABELS[r.agent] ?? r.agent}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {AGENT_MODELS[r.agent] ?? ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono tabular-nums text-sm">
                    <div className="text-foreground">
                      {(r.asr * 100).toFixed(1)}<span className="text-muted-foreground/70 text-xs">% ASR</span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {fmtTps(r.tps)} {t("tok/✓", "토큰/✓")}
                    </div>
                  </div>
                </div>
                {r.sel != null && (
                  <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                    {t(
                      <>
                        Allocates{" "}
                        <span className="text-foreground tabular-nums">
                          {r.sel.toFixed(1)}%
                        </span>{" "}
                        of attempts to this family in free choice
                      </>,
                      <>
                        자유 선택 시 시도의{" "}
                        <span className="text-foreground tabular-nums">
                          {r.sel.toFixed(1)}%
                        </span>
                        를 이 계열에 배분함
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/80 leading-relaxed">
          {t(
            <>
              Ranking on <span className="text-foreground">{familyFull}</span>:{" "}
              <em>balanced</em> is 0.65·accuracy + 0.35·efficiency. <em>Accuracy</em> uses the
              observation-setting per-family ASR; <em>efficiency</em> uses tokens per successful attack.
              A high rank does <em>not</em> imply the agent will attack this family — under free
              choice it may avoid it. See Bias Injection findings for what changes under explicit steering.
            </>,
            <>
              <span className="text-foreground">{familyFull}</span> 기준 순위임.{" "}
              <em>균형</em>은 0.65·정확도 + 0.35·효율이고, <em>정확도</em>는 관찰 설정의 계열별
              ASR, <em>효율</em>은 공격 성공당 토큰을 씀. 순위가 높다고 해서 그 에이전트가 이
              계열을 <em>실제로</em> 공격한다는 뜻은 아님. 자유 선택에서는 오히려 피할 수도 있음.
              명시적으로 지시했을 때 무엇이 달라지는지는 편향 주입 결과에서 확인하면 됨.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function fmtTps(tps: number): string {
  if (!Number.isFinite(tps)) return "—";
  if (tps >= 1000) return `${(tps / 1000).toFixed(0)}k`;
  return tps.toFixed(0);
}
