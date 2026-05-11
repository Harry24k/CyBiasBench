"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/use-theme";

/**
 * Compact horizontal bar chart of an agent's Sel_i distribution across the
 * 10 attack families. Used inside hover tooltips and expanded panels in
 * Layer 1 / leaderboard.
 */
export function MiniFamilyBars({
  selByFamily,
  families,
  familyLabels,
  color,
  height = 180,
  highlightFamily,
}: {
  selByFamily: Record<string, number>;
  families: string[];
  familyLabels: Record<string, string>;
  color: string;
  height?: number;
  highlightFamily?: string;
}) {
  const chart = useChartColors();
  const data = families.map((f) => ({
    family: familyLabels[f] ?? f,
    fkey: f,
    value: (selByFamily[f] ?? 0) * 100,
  }));
  const maxVal = Math.max(0.001, ...data.map((d) => d.value));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxVal / 5) * 5 || 5]}
            tick={{ fontSize: 9, fill: chart.tick }}
            tickFormatter={(v) => `${v}%`}
            stroke={chart.grid}
          />
          <YAxis
            dataKey="family"
            type="category"
            tick={{ fontSize: 10, fill: chart.tick }}
            width={80}
            interval={0}
            stroke={chart.grid}
          />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((d) => (
              <Cell
                key={d.fkey}
                fill={color}
                fillOpacity={
                  highlightFamily && d.fkey !== highlightFamily ? 0.35 : 0.85
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
