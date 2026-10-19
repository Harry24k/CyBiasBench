"use client";

import { AGENT_LABELS } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";
import { useAgentColors } from "@/lib/use-theme";

interface HeatmapProps {
  agents: string[];
  techniques: string[];
  values: Record<string, Record<string, number>>;
  formatValue?: (v: number) => string;
}

function getIntensity(value: number, max: number, isLight: boolean): string {
  if (max === 0) return "bg-muted";
  const ratio = value / max;
  if (ratio === 0) return "bg-transparent";
  if (isLight) {
    if (ratio < 0.15) return "bg-blue-100/50";
    if (ratio < 0.3) return "bg-blue-200/60";
    if (ratio < 0.5) return "bg-blue-300/55";
    if (ratio < 0.7) return "bg-blue-500/40";
    return "bg-blue-600/35";
  }
  if (ratio < 0.15) return "bg-zinc-800/40";
  if (ratio < 0.3) return "bg-zinc-700/40";
  if (ratio < 0.5) return "bg-zinc-600/40";
  if (ratio < 0.7) return "bg-zinc-500/30";
  return "bg-zinc-400/25";
}

export function Heatmap({ agents, techniques, values, formatValue }: HeatmapProps) {
  const fmt = formatValue ?? ((v: number) => `${(v * 100).toFixed(1)}%`);
  const isLight = useTheme();
  const agentColors = useAgentColors();

  const agentMax: Record<string, number> = {};
  for (const a of agents) {
    const vals = techniques.map((t) => values[a]?.[t] ?? 0);
    agentMax[a] = Math.max(...vals, 0.001);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2 font-semibold text-foreground">Attack Family</th>
            {agents.map((a) => (
              <th key={a} className="p-2 text-center font-medium" style={{ color: agentColors[a as keyof typeof agentColors] }}>
                {AGENT_LABELS[a] ?? a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {techniques.map((tech) => (
            <tr key={tech} className="border-t border-border">
              <td className="p-2 font-mono text-xs text-muted-foreground">{tech}</td>
              {agents.map((a) => {
                const val = values[a]?.[tech] ?? 0;
                return (
                  <td key={a} className={`p-2 text-center font-mono text-xs ${getIntensity(val, agentMax[a], isLight)}`}>
                    {fmt(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
