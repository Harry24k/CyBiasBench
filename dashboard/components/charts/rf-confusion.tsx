"use client";

/**
 * RfConfusion
 * -----------
 * Mirror of the paper's "Agent identification by selection pattern" analysis
 * (RandomForest, leave-one-session-out classification of which agent produced
 * a given session selection vector).
 *
 * Data keys consumed (from PaperSummary.agent_identification_rf):
 *   - metrics.leave_one_out: { accuracy, macro_f1, n }
 *   - metrics.stratified_5fold: optional secondary fold metrics (not rendered
 *     directly here, kept for future use)
 *   - per_agent[]: { agent, precision, recall, f1, support }
 *   - feature_importance[]: optional, top features
 *   - baseline_accuracy: number (e.g. 0.20 = uniform 5-class chance)
 *
 * Interactivity:
 *   - F1 column doubles as an inline color-bar (width proportional to F1).
 *   - Per-agent rows sorted by F1 descending, with the agent identifier strip
 *     using AGENT_LABELS so the table reads like the paper's appendix.
 *   - Top-5 feature importance block renders only when at least one non-null
 *     entry is provided.
 */

import { useMemo } from "react";
import {
  AGENT_LABELS,
  type AgentIdentificationRf,
} from "@/lib/types";
import { useAgentColors, useTheme } from "@/lib/use-theme";

interface Props {
  rf: AgentIdentificationRf;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default function RfConfusion({ rf }: Props) {
  const isLight = useTheme();
  const agentColors = useAgentColors();

  const loo = rf.metrics.leave_one_out;
  const baseline = rf.baseline_accuracy ?? 0.2;
  const delta = loo.accuracy - baseline;

  const sorted = useMemo(
    () => [...rf.per_agent].sort((a, b) => b.f1 - a.f1),
    [rf.per_agent],
  );

  const features = useMemo(() => {
    const fi = rf.feature_importance ?? [];
    const valid = fi.filter(
      (e) => e && e.importance != null && Number.isFinite(e.importance),
    );
    if (!valid.length) return [];
    return [...valid]
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 5);
  }, [rf.feature_importance]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">
          Agent identification by selection pattern (RF, leave-one-session-out)
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          A random forest trained on per-session selection vectors classifies
          the originating agent at ~{pct(loo.accuracy)} accuracy vs{" "}
          {pct(baseline)} chance baseline; selection profiles are
          agent-specific.
        </p>
      </div>

      {/* Stat trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <Stat label="Accuracy (LOO)" value={pct(loo.accuracy)} />
        <Stat label="Macro F1 (LOO)" value={pct(loo.macro_f1)} />
        <Stat label="Sessions (n)" value={String(loo.n)} mono />
      </div>

      <div
        className={`text-xs rounded-md border px-3 py-2 mb-4 ${
          delta >= 0
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "border-rose-500/40 text-rose-700 dark:text-rose-300"
        }`}
      >
        vs baseline ({pct(baseline)}):{" "}
        <span className="font-semibold">
          {delta >= 0 ? "+" : ""}
          {pct(delta)}
        </span>{" "}
        absolute lift over uniform-class chance.
      </div>

      {/* Per-agent table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 font-medium text-muted-foreground">
                Agent
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                Precision
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                Recall
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                F1
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                Support
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const f1Pct = Math.max(0, Math.min(1, row.f1)) * 100;
              const color = agentColors[row.agent] ?? "#888";
              return (
                <tr key={row.agent} className="border-b border-border/60">
                  <td className="p-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-foreground align-middle">
                      {AGENT_LABELS[row.agent] ?? row.agent}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono text-xs text-foreground">
                    {pct(row.precision)}
                  </td>
                  <td className="p-2 text-right font-mono text-xs text-foreground">
                    {pct(row.recall)}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-sm flex-1 max-w-[140px]"
                        style={{
                          background: isLight ? "#e5e7eb" : "#27272a",
                        }}
                      >
                        <div
                          className="h-2 rounded-sm"
                          style={{
                            width: `${f1Pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-foreground tabular-nums">
                        {pct(row.f1)}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                    {row.support}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {features.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Top features
          </h4>
          <ul className="space-y-1">
            {features.map((f, i) => {
              const max = features[0]?.importance ?? 1;
              const w = Math.max(
                0,
                Math.min(1, (f.importance ?? 0) / (max || 1)),
              );
              return (
                <li
                  key={`${f.feature ?? "feat"}-${i}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-32 truncate font-mono text-foreground">
                    {f.feature ?? `feature ${i + 1}`}
                  </span>
                  <div
                    className="flex-1 h-1.5 rounded-sm"
                    style={{
                      background: isLight ? "#e5e7eb" : "#27272a",
                    }}
                  >
                    <div
                      className="h-1.5 rounded-sm bg-blue-500"
                      style={{ width: `${w * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-muted-foreground w-14 text-right tabular-nums">
                    {(f.importance ?? 0).toFixed(3)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-lg font-semibold text-foreground ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
