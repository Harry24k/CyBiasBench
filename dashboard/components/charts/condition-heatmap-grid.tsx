"use client";

import { useMounted } from "@/lib/use-mounted";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme, useMediaQuery } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";
import { useT } from "@/lib/i18n";

const COND_ORDER = ["UU", "US", "GU", "GS"] as const;
type Cond = (typeof COND_ORDER)[number];

const COND_LABELS: Record<Cond, { short: string; long: string; longKo: string }> = {
  UU: { short: "UU", long: "Unguided · Unstructured", longKo: "비유도 · 비구조" },
  US: { short: "US", long: "Unguided · Structured", longKo: "비유도 · 구조" },
  GU: { short: "GU", long: "Guided · Unstructured", longKo: "유도 · 비구조" },
  GS: { short: "GS", long: "Guided · Structured", longKo: "유도 · 구조" },
};

function cellStyleFromRank(rank01: number, isLight: boolean) {
  const ratio = Math.max(0, Math.min(1, rank01));
  if (isLight) {
    const h = 228 - ratio * 6;
    const s = 30 + ratio * 45;
    const l = 97 - ratio * 42;
    return { bg: `hsl(${h}, ${s}%, ${l}%)`, text: ratio > 0.45 ? "#1e293b" : "#475569" };
  }
  const h = 245 - ratio * 30;
  const s = 45 + ratio * 30;
  const l = 14 + ratio * 42;
  return { bg: `hsl(${h}, ${s}%, ${l}%)`, text: "#f8fafc" };
}

function rankWithinPanel(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 0.5);
  const sorted = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].v === sorted[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks.map((r) => (r - 1) / (n - 1));
}

interface CellSelection {
  agent: string;
  family: string;
}

export function ConditionHeatmapGrid({
  agents,
  families,
  familyLabels,
  byCondition,
  pooledByAgent,
}: {
  agents: string[];
  families: string[];
  familyLabels: Record<string, string>;
  byCondition: Record<string, Record<string, Record<string, number>>>;
  /** Pooled (across-condition) Sel_i fraction (0..1) per agent×family. */
  pooledByAgent?: Record<string, Record<string, number>>;
}) {
  const t = useT();
  const isLight = useTheme();
  const [active, setActive] = useState<CellSelection | null>(null);

  const rankByPanel: Record<string, number[][]> = {};
  for (const c of COND_ORDER) {
    const block = byCondition[c] ?? {};
    const flat: number[] = [];
    for (const a of agents) {
      const row = block[a] ?? {};
      for (const f of families) flat.push(row[f] ?? 0);
    }
    const flatRanks = rankWithinPanel(flat);
    const grid: number[][] = [];
    for (let i = 0; i < agents.length; i++) {
      grid.push(flatRanks.slice(i * families.length, (i + 1) * families.length));
    }
    rankByPanel[c] = grid;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-3xl">
          {t(
            <>
              Selection share Sel<sub>i</sub> split by the four prompt conditions of the 2×2
              design (Guidance × Format). Color intensity uses{" "}
              <strong className="text-foreground">average-rank normalization within each panel</strong>
              {" "}(matches paper Fig. heatmap_sel) — strong contrast highlights each
              panel&apos;s hot cells; absolute magnitude is in the printed cell value.
              Hover any cell for the comparison to that agent&apos;s pooled Sel<sub>i</sub>;
              click to compare all four prompt conditions side-by-side.
            </>,
            <>
              2×2 설계(유도 × 형식)의 네 가지 프롬프트 조건별로 구분한 선택 비중 Sel<sub>i</sub>임.
              색 농도는{" "}
              <strong className="text-foreground">패널 내부의 평균 순위로 정규화</strong>
              {" "}한 값임(논문 heatmap_sel 그림과 동일). 대비를 강하게 설정하여 패널별로
              두드러지는 칸이 식별되도록 하였으며, 절대 크기는 칸에 표기된 값으로 확인함.
              칸에 마우스를 올리면 해당 에이전트의 통합 Sel<sub>i</sub>와 비교되고,
              클릭하면 네 조건을 나란히 확인할 수 있음.
            </>
          )}
        </p>
        <RankLegend isLight={isLight} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {COND_ORDER.map((c) => (
          <CondPanel
            key={c}
            cond={c}
            agents={agents}
            families={families}
            familyLabels={familyLabels}
            data={byCondition[c] ?? {}}
            rankGrid={rankByPanel[c]}
            isLight={isLight}
            pooledByAgent={pooledByAgent}
            onSelect={(agent, family) => setActive({ agent, family })}
          />
        ))}
      </div>

      {active && (
        <CellDialog
          agent={active.agent}
          family={active.family}
          familyLabels={familyLabels}
          byCondition={byCondition}
          pooledByAgent={pooledByAgent}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function RankLegend({ isLight }: { isLight: boolean }) {
  const t = useT();
  const stops = [0, 0.25, 0.5, 0.75, 1].map((r) => cellStyleFromRank(r, isLight).bg);
  const gradient = `linear-gradient(to right, ${stops.join(", ")})`;
  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {t("Within-panel rank", "패널 내 순위")}
      </span>
      <div
        className="h-2.5 w-44 rounded-sm border border-border"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <div className="flex justify-between w-44 text-[10px] font-mono text-muted-foreground tabular-nums">
        <span>{t("low (0%)", "낮음 (0%)")}</span>
        <span>{t("median", "중앙값")}</span>
        <span>{t("high (100%)", "높음 (100%)")}</span>
      </div>
    </div>
  );
}

function CondPanel({
  cond,
  agents,
  families,
  familyLabels,
  data,
  rankGrid,
  isLight,
  pooledByAgent,
  onSelect,
}: {
  cond: Cond;
  agents: string[];
  families: string[];
  familyLabels: Record<string, string>;
  data: Record<string, Record<string, number>>;
  rankGrid: number[][];
  isLight: boolean;
  pooledByAgent?: Record<string, Record<string, number>>;
  onSelect: (agent: string, family: string) => void;
}) {
  const t = useT();
  const meta = COND_LABELS[cond];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-border bg-muted/40">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-bold text-foreground tabular-nums">
            {meta.short}
          </span>
          <span className="text-xs text-muted-foreground">{t(meta.long, meta.longKo)}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-20">
                {t("Agent", "에이전트")}
              </th>
              {families.map((f) => (
                <th
                  key={f}
                  className="px-1.5 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase whitespace-nowrap"
                >
                  {familyLabels[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => (
              <tr key={a}>
                <td className="px-3 py-1.5 text-xs font-medium text-foreground whitespace-nowrap border-t border-border">
                  {AGENT_LABELS[a] ?? a}
                </td>
                {families.map((f, j) => {
                  const v = data[a]?.[f] ?? 0;
                  const r = rankGrid[i]?.[j] ?? 0;
                  const s = cellStyleFromRank(r, isLight);
                  const pooledPct = (pooledByAgent?.[a]?.[f] ?? 0) * 100;
                  return (
                    <HeatmapCell
                      key={f}
                      v={v}
                      style={s}
                      agentLabel={AGENT_LABELS[a] ?? a}
                      familyLabel={familyLabels[f] ?? f}
                      pooledPct={pooledPct}
                      condLabel={meta.short}
                      onClick={() => onSelect(a, f)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatmapCell({
  v,
  style,
  agentLabel,
  familyLabel,
  pooledPct,
  condLabel,
  onClick,
}: {
  v: number;
  style: { bg: string; text: string };
  agentLabel: string;
  familyLabel: string;
  pooledPct: number;
  condLabel: string;
  onClick: () => void;
}) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const cellRef = useRef<HTMLTableCellElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean; width: number }>({ top: 0, left: 0, placeAbove: true, width: 280 });
  const mounted = useMounted();
  // Touch devices fire synthetic mouseenter on tap, which would open the
  // tooltip and the modal simultaneously. Only enable hover on devices
  // whose primary input actually supports hover (desktop pointers).
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  useLayoutEffect(() => {
    if (!hover || !cellRef.current) return;
    const update = () => {
      const r = cellRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Clamp tooltip width to viewport so 320 px phones don't see overflow.
      const w = Math.min(280, vw - 16);
      const margin = 10;
      const placeAbove = r.top > 220;
      const top = placeAbove ? r.top - margin - 200 : r.bottom + margin;
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(8, Math.min(left, vw - w - 8));
      setCoords({ top: Math.max(8, Math.min(top, vh - 220)), left, placeAbove, width: w });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hover]);
  const delta = v - pooledPct;
  const sign = delta > 0 ? "+" : "";
  return (
    <td
      ref={cellRef}
      className="p-0 border-t border-border"
      onMouseEnter={canHover ? () => setHover(true) : undefined}
      onMouseLeave={canHover ? () => setHover(false) : undefined}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full px-1 py-1.5 text-center font-mono text-[11px] font-semibold tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300"
        style={{ backgroundColor: style.bg, color: style.text }}
        aria-label={t(
          `${agentLabel} ${familyLabel} ${v.toFixed(2)} percent under ${condLabel}`,
          `${agentLabel} ${familyLabel}, ${condLabel} 조건에서 ${v.toFixed(2)} 퍼센트`
        )}
      >
        {v >= 0.05 ? v.toFixed(1) : "-"}
      </button>
      {mounted && hover && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 1000, pointerEvents: "none" }}
          className="rounded-lg border border-border bg-card shadow-2xl p-4 text-sm"
        >
          <div className="font-semibold text-foreground mb-1">
            {agentLabel} · {familyLabel}
          </div>
          <div className="font-mono text-foreground tabular-nums">
            {condLabel}: <span className="font-semibold">{v.toFixed(2)}%</span>
          </div>
          <div className="font-mono text-muted-foreground tabular-nums">
            {t("Pooled Sel", "통합 Sel")}<sub>i</sub>: {pooledPct.toFixed(2)}%
          </div>
          <div
            className="font-mono tabular-nums mt-0.5"
            style={{
              color:
                Math.abs(delta) < 0.5
                  ? "var(--muted-foreground, #71717a)"
                  : delta > 0
                  ? "#16a34a"
                  : "#dc2626",
            }}
          >
            Δ {sign}
            {delta.toFixed(2)} {t("pp vs pooled", "pp (통합 대비)")}
          </div>
          <div className="text-muted-foreground mt-1 text-[10px]">
            {t("Click to compare all four conditions", "클릭하면 네 조건을 비교할 수 있음")}
          </div>
        </div>,
        document.body,
      )}
    </td>
  );
}

function CellDialog({
  agent,
  family,
  familyLabels,
  byCondition,
  pooledByAgent,
  onClose,
}: {
  agent: string;
  family: string;
  familyLabels: Record<string, string>;
  byCondition: Record<string, Record<string, Record<string, number>>>;
  pooledByAgent?: Record<string, Record<string, number>>;
  onClose: () => void;
}) {
  const t = useT();
  const mounted = useMounted();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while modal is open so touch users can't scroll the
    // dimmed page underneath.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const values = COND_ORDER.map((c) => ({
    cond: c,
    label: COND_LABELS[c],
    value: byCondition[c]?.[agent]?.[family] ?? 0,
  }));
  const maxV = Math.max(0.001, ...values.map((v) => v.value));
  const pooledPct = (pooledByAgent?.[agent]?.[family] ?? 0) * 100;
  const agentLabel = AGENT_LABELS[agent] ?? agent;
  const familyLabel = familyLabels[family] ?? family;

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card border border-border rounded-lg p-6 max-w-xl w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t(
          `${agentLabel} ${familyLabel} four-condition comparison`,
          `${agentLabel} ${familyLabel} 네 조건 비교`
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-indigo-500 mb-1">
              {t("Condition comparison", "조건 비교")}
            </div>
            <h3 className="font-serif text-xl text-foreground">
              {agentLabel} · {familyLabel}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                <>
                  Sel<sub>i</sub> across the four prompt conditions of the 2×2 design.
                  Pooled Sel<sub>i</sub>:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {pooledPct.toFixed(2)}%
                  </span>
                </>,
                <>
                  2×2 설계의 네 가지 프롬프트 조건별 Sel<sub>i</sub>임.
                  통합 Sel<sub>i</sub>:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {pooledPct.toFixed(2)}%
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            aria-label={t("Close dialog", "대화상자 닫기")}
          >
            {t("Close", "닫기")}
          </button>
        </div>

        <div className="space-y-2">
          {values.map((row) => {
            const pct = (row.value / maxV) * 100;
            return (
              <div key={row.cond} className="flex items-center gap-3">
                <div className="w-10 shrink-0 font-mono text-xs font-bold text-foreground tabular-nums">
                  {row.label.short}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    {t(row.label.long, row.label.longKo)}
                  </div>
                  <div className="relative h-3 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%`, opacity: 0.85 }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right font-mono text-sm tabular-nums text-foreground">
                  {row.value.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground mt-4">
          {t(
            <>Press <span className="font-mono">Esc</span> or click outside to close.</>,
            <><span className="font-mono">Esc</span>를 누르거나 바깥을 클릭하면 닫힘.</>
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
