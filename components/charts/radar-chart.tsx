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
import { MODEL_COLORS, AGENT_LABELS, AGENTS } from "@/lib/types";

interface RadarChartProps {
  data: Record<string, string | number>[];
  height?: number;
}

export function RadarChart({ data, height = 350 }: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#23232a" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fontSize: 11, fill: "#b4b4bc" }}
        />
        <PolarRadiusAxis
          tick={{ fontSize: 10, fill: "#b4b4bc" }}
          domain={[0, 1]}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #23232a",
            fontSize: 12,
            backgroundColor: "#1a1a1e",
            color: "#e4e4e7",
          }}
        />
        {AGENTS.map((agent) => (
          <Radar
            key={agent}
            name={AGENT_LABELS[agent]}
            dataKey={agent}
            stroke={MODEL_COLORS[agent]}
            fill={MODEL_COLORS[agent]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
