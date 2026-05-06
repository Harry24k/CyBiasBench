"use client";

/**
 * TemporalAdaptationBar
 * ---------------------
 * Mirror of the paper's Appendix temporal adaptation table: per-agent
 * post-outcome family-switching probabilities, grouped horizontally.
 *
 * Data keys consumed (from PaperSummary.temporal_adaptation[]):
 *   - agent: string
 *   - switch_after_failure: number (0-1)
 *   - switch_after_success: number (0-1)
 *   - failure_success_switch_ratio: number
 *   - retry_same_endpoint: number (0-1)
 *   - same_family_new_endpoint: number (0-1)
 *   - switch_family_same_endpoint: number (0-1)
 *   - switch_family_new_endpoint: number (0-1)
 *   - repeated_failure_share: number (0-1)
 *
 * Interactivity:
 *   - For each agent: three horizontal bars
 *       (switch_after_failure, switch_after_success, repeated_failure_share)
 *     scaled on a fixed 0-1 axis. Hover surfaces all 8 raw fields via a
 *     custom Recharts Tooltip.
 *   - Per-agent identifier strip uses useAgentColors() for the color cue.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  AGENT_LABELS,
  type TemporalAdaptationRow,
} from "@/lib/types";
import { useAgentColors, useChartColors } from "@/lib/use-theme";

interface Props {
  data: TemporalAdaptationRow[];
}

const SERIES = [
  {
    key: "switch_after_failure" as const,
    label: "Switch after failure",
    color: "#ef4444",
  },
  {
    key: "switch_after_success" as const,
    label: "Switch after success",
    color: "#10b981",
  },
  {
    key: "repeated_failure_share" as const,
    label: "Repeated-failure share",
    color: "#6366f1",
  },
];

export default function TemporalAdaptationBar({ data }: Props) {
  const colors = useChartColors();
  const agentColors = useAgentColors();

  const rows = data.map((r) => ({
    agent: r.agent,
    label: AGENT_LABELS[r.agent] ?? r.agent,
    switch_after_failure: r.switch_after_failure,
    switch_after_success: r.switch_after_success,
    repeated_failure_share: r.repeated_failure_share,
    _raw: r,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">
          Temporal adaptation (paper Appendix mirror)
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Bars: probability of switching family after failure / success /
          repeated-failure share. Failure-induced switching is comparable to
          success-induced switching; agents do not pivot more aggressively
          after failure.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-2">
        {data.map((r) => (
          <div key={r.agent} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: agentColors[r.agent] ?? "#888" }}
            />
            <span className="text-xs text-muted-foreground">
              {AGENT_LABELS[r.agent] ?? r.agent}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", height: Math.max(220, rows.length * 70) }}>
        <ResponsiveContainer>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
            barGap={2}
          >
            <CartesianGrid stroke={colors.grid} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: colors.tick, fontSize: 11 }}
              stroke={colors.grid}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: colors.tick, fontSize: 12 }}
              width={70}
              stroke={colors.grid}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              content={<CustomTooltip />}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: colors.tick }}
              iconType="square"
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[2, 2, 2, 2]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface RowPayload extends TemporalAdaptationRow {
  label: string;
  _raw: TemporalAdaptationRow;
}

interface TooltipShape {
  active?: boolean;
  payload?: Array<{ payload?: RowPayload }>;
}

function CustomTooltip(props: TooltipShape) {
  const { active, payload } = props;
  if (!active || !payload || !payload.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  const r = datum._raw;
  const fmt = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <div className="rounded-md border border-border bg-card text-xs p-2 shadow-md">
      <div className="font-semibold text-foreground mb-1">
        {AGENT_LABELS[r.agent] ?? r.agent}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-foreground">
        <span className="text-muted-foreground">switch after failure</span>
        <span className="font-mono text-right">
          {fmt(r.switch_after_failure)}
        </span>
        <span className="text-muted-foreground">switch after success</span>
        <span className="font-mono text-right">
          {fmt(r.switch_after_success)}
        </span>
        <span className="text-muted-foreground">fail/success ratio</span>
        <span className="font-mono text-right">
          {r.failure_success_switch_ratio.toFixed(2)}
        </span>
        <span className="text-muted-foreground">retry same endpoint</span>
        <span className="font-mono text-right">
          {fmt(r.retry_same_endpoint)}
        </span>
        <span className="text-muted-foreground">same fam, new endpoint</span>
        <span className="font-mono text-right">
          {fmt(r.same_family_new_endpoint)}
        </span>
        <span className="text-muted-foreground">switch fam, same ep</span>
        <span className="font-mono text-right">
          {fmt(r.switch_family_same_endpoint)}
        </span>
        <span className="text-muted-foreground">switch fam, new ep</span>
        <span className="font-mono text-right">
          {fmt(r.switch_family_new_endpoint)}
        </span>
        <span className="text-muted-foreground">repeated-failure share</span>
        <span className="font-mono text-right">
          {fmt(r.repeated_failure_share)}
        </span>
      </div>
    </div>
  );
}
