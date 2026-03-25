"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { MODEL_COLORS, AGENT_LABELS } from "@/lib/types";
import { pctFormatter, labelFormatter } from "@/lib/chart-utils";

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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#23232a" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#a1a1aa" }} />
        <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickFormatter={fmt} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#a1a1aa" } } : undefined} />
        <Tooltip formatter={fmt} contentStyle={{ borderRadius: 8, border: "1px solid #23232a", fontSize: 12, backgroundColor: "#1a1a1e", color: "#e4e4e7" }} />
        <Legend formatter={labelFormatter(AGENT_LABELS)} />
        <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
        <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
        <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
