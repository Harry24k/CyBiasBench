"use client";

import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AGENT_LABELS, AGENTS } from "@/lib/types";
import { useChartColors, useAgentColors } from "@/lib/use-theme";

interface RadarChartProps {
  data: Record<string, string | number>[];
  height?: number;
}

export function RadarChart({ data, height = 350 }: RadarChartProps) {
  const colors = useChartColors();
  const agentColors = useAgentColors();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke={colors.grid} />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fontSize: 11, fill: colors.tick }}
        />
        <PolarRadiusAxis
          tick={{ fontSize: 10, fill: colors.tick }}
          domain={[0, 1]}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${colors.tooltipBorder}`,
            fontSize: 12,
            backgroundColor: colors.tooltipBg,
            color: colors.tooltipText,
          }}
        />
        {AGENTS.map((agent) => (
          <Radar
            key={agent}
            name={AGENT_LABELS[agent]}
            dataKey={agent}
            stroke={agentColors[agent]}
            fill={agentColors[agent]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
