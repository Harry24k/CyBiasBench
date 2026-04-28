"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartColors, useTheme, useAgentColors } from "@/lib/use-theme";
import { AGENT_LABELS } from "@/lib/types";
import type { ScatterPoint } from "@/lib/types";

interface Props {
  agent: string;
  points: ScatterPoint[];
  rho: number;
  pValue: number;
  height?: number;
}

const SUPER_MAP: Record<string, string> = {
  "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074",
  "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
  "-": "\u207B", "+": "\u207A",
};
function toSuper(s: string): string {
  return s.split("").map((c) => SUPER_MAP[c] ?? c).join("");
}
function formatP(p: number): string {
  if (p < 1e-3) {
    const exp = p.toExponential(2);
    const [m, e] = exp.split("e");
    return `${m}\u00D7\u200910${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

export function EntropyAsrScatter({
  agent,
  points,
  rho,
  pValue,
  height = 240,
}: Props) {
  const colors = useChartColors();
  const isLight = useTheme();
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const label = AGENT_LABELS[agent] ?? agent;
  const sig = pValue < 0.05;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <span
          className={`text-sm font-mono tabular-nums ${
            sig ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          ρ = {rho >= 0 ? "+" : ""}
          {rho.toFixed(3)} · p = {formatP(pValue)}
          {sig ? " *" : " n.s."}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey="entropy"
            name="H(X)"
            domain={[0, 3.4]}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "Session entropy H(X)",
              position: "insideBottom",
              offset: -8,
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <YAxis
            type="number"
            dataKey="session_asr"
            name="ASR"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: "Session ASR",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <ZAxis range={[35, 35]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: colors.grid }}
            formatter={(v, name) => {
              const n = typeof v === "number" ? v : Number(v);
              return name === "ASR" ? `${(n * 100).toFixed(1)}%` : n.toFixed(2);
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
            }}
          />
          <Scatter data={points} fill={color} fillOpacity={isLight ? 0.75 : 0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
