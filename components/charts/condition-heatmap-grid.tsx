"use client";

import { useTheme } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";

const COND_ORDER = ["UU", "US", "GU", "GS"] as const;
type Cond = (typeof COND_ORDER)[number];

const COND_LABELS: Record<Cond, { short: string; long: string }> = {
  UU: { short: "UU", long: "Unguided · Unstructured" },
  US: { short: "US", long: "Unguided · Structured" },
  GU: { short: "GU", long: "Guided · Unstructured" },
  GS: { short: "GS", long: "Guided · Structured" },
};

function cellStyleFromRank(rank01: number, isLight: boolean) {
  // rank01 in [0, 1] — average-rank within panel, 1 = highest cell
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

/**
 * Average-rank normalization within a panel. Matches scipy.stats.rankdata
 * with method="average". Returns rank01 ∈ [0, 1], 1 = largest value.
 */
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

export function ConditionHeatmapGrid({
  agents,
  families,
  familyLabels,
  byCondition,
}: {
  agents: string[];
  families: string[];
  familyLabels: Record<string, string>;
  byCondition: Record<string, Record<string, Record<string, number>>>;
}) {
  const isLight = useTheme();

  // Per-panel rank normalization (matches paper heatmap_sel_from_json.py).
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
          Selection share Selᵢ split by the four prompt conditions of the 2×2
          design (Guidance × Format). Color intensity uses{" "}
          <strong className="text-foreground">average-rank normalization within each panel</strong>
          {" "}(matches paper Fig. heatmap_sel) — strong contrast highlights each
          panel's hot cells; absolute magnitude is in the printed cell value.
          Each agent has 9 sessions per condition (3 targets × 3 repetitions).
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
          />
        ))}
      </div>
    </div>
  );
}

function RankLegend({ isLight }: { isLight: boolean }) {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((r) => cellStyleFromRank(r, isLight).bg);
  const gradient = `linear-gradient(to right, ${stops.join(", ")})`;
  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        Within-panel rank
      </span>
      <div
        className="h-2.5 w-44 rounded-sm border border-border"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <div className="flex justify-between w-44 text-[10px] font-mono text-muted-foreground tabular-nums">
        <span>low (0%)</span>
        <span>median</span>
        <span>high (100%)</span>
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
}: {
  cond: Cond;
  agents: string[];
  families: string[];
  familyLabels: Record<string, string>;
  data: Record<string, Record<string, number>>;
  rankGrid: number[][];
  isLight: boolean;
}) {
  const meta = COND_LABELS[cond];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-border bg-muted/40">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-bold text-foreground tabular-nums">
            {meta.short}
          </span>
          <span className="text-xs text-muted-foreground">{meta.long}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-20">
                Agent
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
                  return (
                    <td
                      key={f}
                      className="px-1 py-1.5 text-center font-mono text-[11px] font-semibold tabular-nums border-t border-border"
                      style={{ backgroundColor: s.bg, color: s.text }}
                      title={`${AGENT_LABELS[a] ?? a} · ${familyLabels[f] ?? f}: ${v.toFixed(2)}%`}
                    >
                      {v >= 0.05 ? v.toFixed(1) : "-"}
                    </td>
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
