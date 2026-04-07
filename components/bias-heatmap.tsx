"use client";

import { AGENT_LABELS, AGENT_ICONS } from "@/lib/types";
import { useTheme, useAgentColors } from "@/lib/use-theme";

interface BiasHeatmapProps {
  title: string;
  description: string;
  agents: string[];
  columns: string[];
  columnLabels?: Record<string, string>;
  getValue: (agent: string, col: string) => number | null;
  formatValue?: (v: number, col?: string) => string;
  colorScale?: "diverging" | "sequential";
  normalizePerColumn?: boolean;
  /** When true, renders as inline sub-section (smaller header, no outer wrapper) */
  inline?: boolean;
}

function getHeatmapStyle(value: number, min: number, max: number, isLight: boolean): { bg: string; text: string } {
  if (max === min) return { bg: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", text: isLight ? "#71717a" : "#b4b4bc" };
  const raw = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const ratio = Math.pow(raw, 0.6);

  if (isLight) {
    // Light mode: blue family, lightness inverted (high value = dark)
    const h = 220 - ratio * 10;   // 220→210 (blue, subtle shift)
    const s = 40 + ratio * 40;    // 40→80
    const l = 92 - ratio * 50;    // 92→42 (near-white→deep blue)
    return {
      bg: `hsl(${h}, ${s}%, ${l}%)`,
      text: ratio > 0.3 ? "#ffffff" : "#18181b",
    };
  }

  // Dark mode: Purple → Blue (low = dark, high = bright)
  const h = 270 - ratio * 50;
  const s = 35 + ratio * 28;
  const l = 10 + ratio * 44;
  return {
    bg: `hsl(${h}, ${s}%, ${l}%)`,
    text: ratio > 0.3 ? "#f4f4f5" : "#a0a0a8",
  };
}

export function BiasHeatmap({
  title,
  description,
  agents,
  columns,
  columnLabels,
  getValue,
  formatValue,
  colorScale = "sequential",
  normalizePerColumn = false,
  inline = false,
}: BiasHeatmapProps) {
  const fmt = formatValue ?? ((v: number) => `${(v * 100).toFixed(1)}%`);
  const getLabel = (col: string) => columnLabels?.[col] ?? col;
  const isLight = useTheme();

  let globalMin = Infinity, globalMax = -Infinity;
  const colMin: Record<string, number> = {};
  const colMax: Record<string, number> = {};

  for (const c of columns) {
    let cMin = Infinity, cMax = -Infinity;
    for (const a of agents) {
      const v = getValue(a, c);
      if (v != null) {
        cMin = Math.min(cMin, v);
        cMax = Math.max(cMax, v);
        globalMin = Math.min(globalMin, v);
        globalMax = Math.max(globalMax, v);
      }
    }
    colMin[c] = cMin;
    colMax[c] = cMax;
  }

  function getMinMax(col: string): [number, number] {
    if (normalizePerColumn) return [0, colMax[col] ?? 1];
    return [globalMin, globalMax];
  }

  const legend = normalizePerColumn ? (
    <p className="text-xs text-muted-foreground/60 mt-2 text-right">Color intensity is relative within each column</p>
  ) : null;

  const table = (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm" style={{ borderSpacing: "3px 0", borderCollapse: "separate" }}>
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-5 py-4 font-semibold text-foreground w-36">
              Agent
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-4 text-center font-semibold text-foreground text-sm whitespace-nowrap"
              >
                {getLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent} className="border-t border-border">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full agent-icon-circle flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={AGENT_ICONS[agent] ?? ""}
                      alt={agent}
                      className="w-3.5 h-3.5"
                    />
                  </div>
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {AGENT_LABELS[agent] ?? agent}
                  </span>
                </div>
              </td>
              {columns.map((col) => {
                const val = getValue(agent, col);
                if (val == null) {
                  return (
                    <td key={col} className="px-4 py-4 text-center text-muted-foreground">
                      —
                    </td>
                  );
                }
                const [mn, mx] = getMinMax(col);
                const style = getHeatmapStyle(val, mn, mx, isLight);
                return (
                  <td
                    key={col}
                    className="px-4 py-4 text-center font-mono text-base tabular-nums whitespace-nowrap"
                    style={{ backgroundColor: style.bg, color: style.text }}
                  >
                    {fmt(val, col)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {legend}
    </div>
  );

  if (inline) {
    return (
      <div>
        {title && <h3 className="text-xl font-semibold text-foreground">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted-foreground mb-4">{description}</p>}
        {!title && !description ? table : <div className="mt-4">{table}</div>}
      </div>
    );
  }

  return (
    <section className="max-w-[1500px] mx-auto px-6 mt-20">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {table}
    </section>
  );
}
