"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useChartColors, useTheme, useAgentColors } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";

interface Props {
  agent: string;
  families: string[];
  familyLabels?: Record<string, string>;
  selection: Record<string, number>;
  asrPrior: Record<string, number>;
  maxSel: number;
  maxAsr: number;
  height?: number;
}

export function SelVsAsrRadar({
  agent,
  families,
  familyLabels,
  selection,
  asrPrior,
  maxSel,
  maxAsr,
  height = 260,
}: Props) {
  const colors = useChartColors();
  const isLight = useTheme();
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const label = AGENT_LABELS[agent] ?? agent;
  const priorColor = isLight ? "#52525b" : "#a1a1aa";

  const data = families.map((f) => {
    const s = selection[f] ?? 0;
    const a = asrPrior[f] ?? 0;
    return {
      metric: familyLabels?.[f] ?? f,
      selNorm: maxSel > 0 ? s / maxSel : 0,
      asrNorm: maxAsr > 0 ? a / maxAsr : 0,
      selRaw: s,
      asrRaw: a,
    };
  });

  const topSel = families
    .map((f) => ({ f, v: selection[f] ?? 0 }))
    .sort((x, y) => y.v - x.v)[0];
  const topAsr = families
    .map((f) => ({ f, v: asrPrior[f] ?? 0 }))
    .sort((x, y) => y.v - x.v)[0];

  return (
    <div>
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <div className="text-xs font-mono tabular-nums text-muted-foreground text-right leading-snug">
          <div>
            <span style={{ color }}>Sel peak</span>{" "}
            {(topSel.v * 100).toFixed(1)}% ·{" "}
            {familyLabels?.[topSel.f] ?? topSel.f}
          </div>
          <div>
            ASR peak {(topAsr.v * 100).toFixed(1)}% ·{" "}
            {familyLabels?.[topAsr.f] ?? topAsr.f}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: colors.tick }}
          />
          <PolarRadiusAxis
            tick={false}
            axisLine={false}
            domain={[0, 1]}
            tickCount={4}
          />
          <Tooltip
            formatter={(v, name, props) => {
              const p = props?.payload as { selRaw?: number; asrRaw?: number } | undefined;
              if (name === "selNorm") {
                return [`${((p?.selRaw ?? 0) * 100).toFixed(1)}%`, "Sel"];
              }
              return [`${((p?.asrRaw ?? 0) * 100).toFixed(1)}%`, "ASR"];
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
          />
          <Radar
            name="asrNorm"
            dataKey="asrNorm"
            stroke={priorColor}
            fill="transparent"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.85}
          />
          <Radar
            name="selNorm"
            dataKey="selNorm"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
