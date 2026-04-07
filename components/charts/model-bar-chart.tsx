"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AGENT_LABELS } from "@/lib/types";
import { pctFormatter, labelFormatter } from "@/lib/chart-utils";
import { useChartColors, useAgentColors } from "@/lib/use-theme";

interface ModelBarChartProps {
  data: { name: string; claude?: number; codex?: number; gemini?: number }[];
  title?: string;
  yLabel?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatValue?: (v: any) => string;
  height?: number;
}

export function ModelBarChart({ data, yLabel, formatValue, height = 300 }: ModelBarChartProps) {
  const fmt = formatValue ?? pctFormatter;
  const colors = useChartColors();
  const agentColors = useAgentColors();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: colors.tick }} />
        <YAxis tick={{ fontSize: 12, fill: colors.tick }} tickFormatter={fmt} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 12, fill: colors.tick } } : undefined} />
        <Tooltip formatter={fmt} contentStyle={{ borderRadius: 8, border: `1px solid ${colors.tooltipBorder}`, fontSize: 12, backgroundColor: colors.tooltipBg, color: colors.tooltipText }} />
        <Legend formatter={labelFormatter(AGENT_LABELS)} />
        <Bar dataKey="claude" fill={agentColors.claude} radius={[4, 4, 0, 0]} />
        <Bar dataKey="codex" fill={agentColors.codex} radius={[4, 4, 0, 0]} />
        <Bar dataKey="gemini" fill={agentColors.gemini} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
