"use client";

import { MODEL_COLORS, AGENT_LABELS, AGENT_ICONS } from "@/lib/types";

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

function getSequentialColor(value: number, min: number, max: number): string {
  if (max === min) return "bg-zinc-800/30";
  const ratio = (value - min) / (max - min);
  if (ratio < 0.2) return "bg-zinc-800/40";
  if (ratio < 0.4) return "bg-zinc-700/50";
  if (ratio < 0.6) return "bg-zinc-600/50";
  if (ratio < 0.8) return "bg-zinc-500/40";
  return "bg-zinc-400/35";
}

function getTextColor(value: number, min: number, max: number): string {
  if (max === min) return "text-muted-foreground";
  const ratio = (value - min) / (max - min);
  return ratio > 0.5 ? "text-foreground" : "text-muted-foreground";
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
    if (normalizePerColumn) return [colMin[col] ?? 0, colMax[col] ?? 1];
    return [globalMin, globalMax];
  }

  const table = (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-5 py-4 font-semibold text-foreground w-36">
              Agent
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-4 text-center font-semibold text-foreground text-sm"
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
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${typeof window !== "undefined" && process.env.NODE_ENV === "production" ? "/CyBiasBench" : ""}${AGENT_ICONS[agent] ?? ""}`}
                      alt={agent}
                      className="w-3.5 h-3.5"
                    />
                  </div>
                  <span className="font-medium text-foreground">
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
                return (
                  <td
                    key={col}
                    className={`px-4 py-4 text-center font-mono text-base tabular-nums ${getSequentialColor(val, mn, mx)} ${getTextColor(val, mn, mx)}`}
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
    <section className="max-w-[1300px] mx-auto px-6 mt-20">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {table}
    </section>
  );
}
