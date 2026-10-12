"use client";

/**
 * AsrPerFamilyHeatmap — per-family attack success rate (ASR_i) across all 5 agents.
 *
 * Two layouts:
 *   • Mobile  : 5 stacked agent cards, each a sorted bar list of 10 families.
 *               Selᵢ-top family tagged "Sel"; ASR_i-top family tagged ★.
 *   • Desktop : compact heatmap with sticky family column, indigo sequential
 *               ramp, color legend, hover-driven row/col header highlight,
 *               and a portal tooltip with full context per cell.
 *
 * Both layouts surface the same Selᵢ ⊥ ASRᵢ decoupling story by always
 * marking the agent's most-selected family AND the agent's best-ASR family
 * — so the visual mismatch is the point.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AGENT_LABELS,
  FAMILY_FULLNAME,
  type PaperSummary,
} from "@/lib/types";
import { useAgentColors, useTheme } from "@/lib/use-theme";
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

interface Props {
  data: Pick<
    PaperSummary,
    "agents" | "families" | "fig3_asri_per_agent" | "table1_agent_signatures"
  >;
}

// Indigo sequential ramp keyed off normalized ASR_i. Matches the Bias
// Evaluation axis colour family used elsewhere on the site.
function rampColor(value: number, max: number, isLight: boolean): string {
  const v = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  if (isLight) {
    // indigo-50 (#eef2ff) → indigo-600 (#4f46e5)
    const r = Math.round(238 + (79 - 238) * v);
    const g = Math.round(242 + (70 - 242) * v);
    const b = Math.round(255 + (229 - 255) * v);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // dark: from #0e0f1a → indigo-400 (#818cf8)
  const r = Math.round(14 + (129 - 14) * v);
  const g = Math.round(15 + (140 - 15) * v);
  const b = Math.round(26 + (248 - 26) * v);
  return `rgb(${r}, ${g}, ${b})`;
}

function textColor(value: number, max: number, isLight: boolean): string {
  const v = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  if (isLight) return v > 0.55 ? "#ffffff" : "#0f172a";
  return v > 0.55 ? "#ffffff" : "#e5e7eb";
}

interface CellState {
  family: string;
  agent: string;
  rect: DOMRect;
}

export default function AsrPerFamilyHeatmap({ data }: Props) {
  const t = useT();
  const isLight = useTheme();
  const agentColors = useAgentColors();
  const [sortByMax, setSortByMax] = useState(false);
  const [hover, setHover] = useState<CellState | null>(null);

  const agents = data.agents;
  const asri = data.fig3_asri_per_agent ?? {};
  const sigs = data.table1_agent_signatures ?? {};

  const families = useMemo(() => {
    if (!sortByMax) return data.families;
    const withMax = data.families.map((f) => {
      const max = Math.max(...agents.map((a) => asri[a]?.[f] ?? 0));
      return { f, max };
    });
    withMax.sort((a, b) => b.max - a.max);
    return withMax.map((x) => x.f);
  }, [sortByMax, data.families, agents, asri]);

  // Per-agent: most-selected family (from signatures) and best-ASR family.
  const annotations = useMemo(() => {
    const m: Record<string, { topSel?: string; topAsr?: string }> = {};
    for (const a of agents) {
      const topSel = sigs[a]?.top_family;
      let topAsr: string | undefined;
      let best = -Infinity;
      for (const f of data.families) {
        const v = asri[a]?.[f] ?? 0;
        if (v > best) {
          best = v;
          topAsr = f;
        }
      }
      m[a] = { topSel, topAsr };
    }
    return m;
  }, [agents, sigs, asri, data.families]);

  const maxAsr = useMemo(() => {
    let m = 0;
    for (const a of agents) for (const f of data.families) {
      const v = asri[a]?.[f] ?? 0;
      if (v > m) m = v;
    }
    return m || 1;
  }, [agents, data.families, asri]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      {/* Header: title + color legend + sort toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            {t("Per-family ASR", "계열별 ASR")}<sub>i</sub>
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            {t(
              <>
                Each agent&apos;s success rate on every attack family. The{" "}
                <span className="inline-flex items-center align-middle gap-1">
                  <span
                    aria-hidden
                    className="inline-block w-3 h-3 rounded-sm border-2 border-foreground"
                  />{" "}
                  <span className="font-medium text-foreground">Sel</span>
                </span>{" "}
                outline marks each agent&apos;s most-selected family;{" "}
                <span className="text-foreground font-semibold">★</span> marks each
                agent&apos;s highest-ASR<sub>i</sub> family. They almost never
                coincide — that gap is the Sel<sub>i</sub>—ASR<sub>i</sub> decoupling.
              </>,
              <>
                에이전트별 모든 공격 계열에 대한 성공률임.{" "}
                <span className="inline-flex items-center align-middle gap-1">
                  <span
                    aria-hidden
                    className="inline-block w-3 h-3 rounded-sm border-2 border-foreground"
                  />{" "}
                  <span className="font-medium text-foreground">Sel</span>
                </span>{" "}
                테두리는 해당 에이전트의 최다 선택 계열을,{" "}
                <span className="text-foreground font-semibold">★</span>는 ASR<sub>i</sub>가
                가장 높은 계열을 표시함. 양자가 일치하는 경우는 거의 없으며, 그 간극이 곧
                Sel<sub>i</sub>—ASR<sub>i</sub> 비결합임.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <ColorLegend isLight={isLight} maxAsr={maxAsr} />
          <button
            type="button"
            onClick={() => setSortByMax((s) => !s)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors whitespace-nowrap"
          >
            {sortByMax
              ? t("Canonical order", "기본 순서")
              : t("Sort by max ASRᵢ", "최대 ASRᵢ 순 정렬")}
          </button>
        </div>
      </div>

      {/* Mobile: per-agent stacked bar list */}
      <div className="md:hidden space-y-3">
        {agents.map((a) => (
          <MobileAgentCard
            key={a}
            agent={a}
            color={agentColors[a] ?? "#888"}
            families={families}
            asri={asri[a] ?? {}}
            topSel={annotations[a]?.topSel}
            topAsr={annotations[a]?.topAsr}
          />
        ))}
      </div>

      {/* Desktop: heatmap with hover affordance */}
      <div className="hidden md:block relative">
        <div
          className="grid gap-px text-xs"
          style={{
            gridTemplateColumns: `minmax(120px, 0.8fr) repeat(${agents.length}, minmax(72px, 1fr))`,
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Header row */}
          <div className="bg-card px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {t("family ／ agent", "계열 ／ 에이전트")}
          </div>
          {agents.map((a) => {
            const isHover = hover?.agent === a;
            return (
              <div
                key={`h-${a}`}
                className={`bg-card px-2 py-2 text-center transition-colors ${
                  isHover ? "text-foreground font-semibold" : "text-muted-foreground font-medium"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: agentColors[a] ?? "#888" }}
                  />
                  <span>{AGENT_LABELS[a] ?? a}</span>
                </div>
              </div>
            );
          })}

          {/* Body rows */}
          {families.map((f) => {
            const isRowHover = hover?.family === f;
            return (
              <FamilyRow
                key={f}
                family={f}
                agents={agents}
                asri={asri}
                annotations={annotations}
                isLight={isLight}
                maxAsr={maxAsr}
                hover={hover}
                setHover={setHover}
                isRowHover={isRowHover}
              />
            );
          })}
        </div>

        {/* Portal tooltip */}
        {hover && (
          <CellTooltip
            family={hover.family}
            agent={hover.agent}
            value={asri[hover.agent]?.[hover.family] ?? 0}
            isTopSel={annotations[hover.agent]?.topSel === hover.family}
            isTopAsr={annotations[hover.agent]?.topAsr === hover.family}
            agentColor={agentColors[hover.agent] ?? "#888"}
            rect={hover.rect}
          />
        )}
      </div>
    </div>
  );
}

function FamilyRow({
  family,
  agents,
  asri,
  annotations,
  isLight,
  maxAsr,
  hover,
  setHover,
  isRowHover,
}: {
  family: string;
  agents: string[];
  asri: Record<string, Record<string, number>>;
  annotations: Record<string, { topSel?: string; topAsr?: string }>;
  isLight: boolean;
  maxAsr: number;
  hover: CellState | null;
  setHover: (s: CellState | null) => void;
  isRowHover: boolean;
}) {
  return (
    <>
      <div
        className={`px-2 py-2 font-mono text-[11px] truncate transition-colors ${
          isRowHover
            ? "bg-card text-foreground font-semibold"
            : "bg-card text-muted-foreground"
        }`}
      >
        <abbr
          title={FAMILY_FULLNAME[family] ?? family}
          className="no-underline decoration-dotted decoration-muted-foreground/40 underline underline-offset-2 cursor-help"
        >
          {FAMILY_LABELS[family] ?? family}
        </abbr>
      </div>
      {agents.map((a) => {
        const v = asri[a]?.[family] ?? 0;
        const isTopSel = annotations[a]?.topSel === family;
        const isTopAsr = annotations[a]?.topAsr === family;
        const isCellHover = hover?.agent === a && hover?.family === family;
        const isOtherHover = hover && !isCellHover && hover.agent !== a && hover.family !== family;
        return (
          <button
            key={`${family}-${a}`}
            type="button"
            tabIndex={0}
            onMouseEnter={(e) =>
              setHover({
                family,
                agent: a,
                rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
              })
            }
            onFocus={(e) =>
              setHover({
                family,
                agent: a,
                rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
              })
            }
            className={`relative px-2 py-2 text-center font-mono tabular-nums transition-[opacity,transform] duration-150 cursor-default focus:outline-none ${
              isCellHover ? "z-20 scale-[1.04] shadow-md" : ""
            } ${isOtherHover ? "opacity-30" : "opacity-100"}`}
            style={{
              backgroundColor: rampColor(v, maxAsr, isLight),
              color: textColor(v, maxAsr, isLight),
              outline: isTopSel
                ? "2px solid var(--color-foreground, #0f172a)"
                : undefined,
              outlineOffset: isTopSel ? "-2px" : undefined,
            }}
          >
            {(v * 100).toFixed(1)}%
            {isTopAsr && (
              <span
                aria-hidden
                className="absolute top-0.5 right-1 text-[10px] leading-none"
                style={{ color: textColor(v, maxAsr, isLight) }}
              >
                ★
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function CellTooltip({
  family,
  agent,
  value,
  isTopSel,
  isTopAsr,
  agentColor,
  rect,
}: {
  family: string;
  agent: string;
  value: number;
  isTopSel: boolean;
  isTopAsr: boolean;
  agentColor: string;
  rect: DOMRect;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const W = 300;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Default below-cell, flip if close to bottom.
  const placeAbove = rect.bottom + 200 > vh;
  let top = placeAbove ? rect.top - 200 - margin : rect.bottom + margin;
  let left = rect.left + rect.width / 2 - W / 2;
  left = Math.max(8, Math.min(left, vw - W - 8));
  top = Math.max(8, Math.min(top, vh - 200));

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top,
        left,
        width: W,
        zIndex: 1000,
        pointerEvents: "none",
      }}
      className="rounded-lg border border-border bg-card shadow-2xl p-3.5 text-sm"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: agentColor }}
          />
          <span className="font-semibold text-foreground truncate">
            {AGENT_LABELS[agent] ?? agent}
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          {FAMILY_LABELS[family] ?? family}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground mb-3">
        {FAMILY_FULLNAME[family] ?? family}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-mono tabular-nums text-2xl font-semibold text-foreground">
          {(value * 100).toFixed(1)}%
        </span>
        <span className="text-[11px] text-muted-foreground">ASR<sub>i</sub></span>
      </div>
      <div className="relative h-1.5 rounded-full bg-foreground/10 overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.min(100, value * 100)}%`,
            backgroundColor: agentColor,
            opacity: 0.8,
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        {isTopSel && (
          <div className="text-[11px] flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm border-2 border-foreground shrink-0"
              aria-hidden
            />
            <span className="text-foreground">
              {t(
                <>
                  <strong>Most-selected family</strong> for {AGENT_LABELS[agent] ?? agent}
                </>,
                <>
                  {AGENT_LABELS[agent] ?? agent}의 <strong>최다 선택 계열</strong>
                </>
              )}
            </span>
          </div>
        )}
        {isTopAsr && (
          <div className="text-[11px] flex items-center gap-1.5">
            <span className="text-foreground font-semibold leading-none">★</span>
            <span className="text-foreground">
              {t(
                <>
                  <strong>Best ASR<sub>i</sub></strong> across all 10 families for this agent
                </>,
                <>
                  해당 에이전트의 10종 계열 중 <strong>ASR<sub>i</sub> 최고</strong>
                </>
              )}
            </span>
          </div>
        )}
        {isTopSel && isTopAsr && (
          <div className="text-[11px] text-emerald-500">
            {t("Selection ⇄ Performance aligned here.", "해당 지점에서는 선택 ⇄ 성능이 일치함.")}
          </div>
        )}
        {isTopSel && !isTopAsr && (
          <div className="text-[11px] text-amber-500">
            {t(
              <>Decoupling: agent picks this most, but achieves higher ASR<sub>i</sub> elsewhere.</>,
              <>비결합: 해당 계열을 가장 많이 선택하나, ASR<sub>i</sub>는 타 계열에서 더 높음.</>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ColorLegend({
  isLight,
  maxAsr,
}: {
  isLight: boolean;
  maxAsr: number;
}) {
  // Build a 5-stop gradient string matching the rampColor function.
  const stops = Array.from({ length: 6 }, (_, i) => {
    const v = i / 5;
    return rampColor(v * maxAsr, maxAsr, isLight);
  });
  const gradient = `linear-gradient(90deg, ${stops.join(", ")})`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
        0%
      </span>
      <div
        className="h-2 w-20 sm:w-28 rounded-full border border-border"
        style={{ background: gradient }}
        aria-hidden
      />
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
        {(maxAsr * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function MobileAgentCard({
  agent,
  color,
  families,
  asri,
  topSel,
  topAsr,
}: {
  agent: string;
  color: string;
  families: string[];
  asri: Record<string, number>;
  topSel?: string;
  topAsr?: string;
}) {
  const t = useT();
  const max = Math.max(...families.map((f) => asri[f] ?? 0), 0.0001);
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-semibold text-foreground">
          {AGENT_LABELS[agent] ?? agent}
        </span>
        {topAsr && (
          <span
            className="ml-auto text-[10px] font-mono text-muted-foreground"
            title={t(
              `Best ASRᵢ: ${FAMILY_FULLNAME[topAsr] ?? topAsr}`,
              `ASRᵢ 최고: ${FAMILY_FULLNAME[topAsr] ?? topAsr}`
            )}
          >
            {t("best", "최고")} ★ {FAMILY_LABELS[topAsr] ?? topAsr}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {families.map((f) => {
          const v = asri[f] ?? 0;
          const pct = (v / max) * 100;
          const isSel = f === topSel;
          const isBest = f === topAsr;
          return (
            <div
              key={f}
              className="grid grid-cols-[78px_1fr_56px] items-center gap-2 text-[11px]"
            >
              <div className="font-mono truncate flex items-center gap-1">
                <abbr
                  title={FAMILY_FULLNAME[f] ?? f}
                  className={`no-underline decoration-dotted decoration-muted-foreground/40 underline underline-offset-2 cursor-help ${
                    isSel ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {FAMILY_LABELS[f] ?? f}
                </abbr>
                {isBest && (
                  <span aria-hidden className="text-foreground text-[10px] leading-none">
                    ★
                  </span>
                )}
              </div>
              <div className="relative h-2 rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: color,
                    opacity: isSel || isBest ? 0.9 : 0.6,
                  }}
                />
                {isSel && (
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 right-0 rounded-full ring-2 ring-foreground/40 pointer-events-none"
                  />
                )}
              </div>
              <div className="text-right font-mono tabular-nums text-foreground">
                {(v * 100).toFixed(1)}%
                {isSel && (
                  <span className="ml-1 text-[9px] text-muted-foreground uppercase tracking-wider">
                    sel
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
