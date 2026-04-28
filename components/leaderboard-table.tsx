"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AGENT_LABELS,
  AGENT_MODELS,
  AGENT_ICONS,
} from "@/lib/types";
import type { PaperSummary } from "@/lib/types";

type SortDir = "asc" | "desc";

interface Column {
  key: string;
  group: "bias" | "performance" | "robustness";
  label: string;
  desc: string;
  higher: boolean;
  format: (v: number | null) => string;
  getValue: (agent: string, data: PaperSummary) => number | null;
}

const COLUMNS: Column[] = [
  // Bias Evaluation
  {
    key: "entropy",
    group: "bias",
    label: "H(X)",
    desc: "Technique Entropy",
    higher: true,
    format: (v) => v != null ? v.toFixed(2) : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.entropy ?? null,
  },
  {
    key: "top_sel",
    group: "bias",
    label: "Top Selᵢ",
    desc: "Dominant Family Share",
    higher: false,
    format: (v) => v != null ? `${v.toFixed(1)}%` : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.top_share ?? null,
  },
  // Attack Performance
  {
    key: "session_asr",
    group: "performance",
    label: "ASR",
    desc: "Session Attack Success Rate",
    higher: true,
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.session_asr_mean ?? null,
  },
  {
    key: "tps",
    group: "performance",
    label: "TPS",
    desc: "Tokens Per Success",
    higher: false,
    format: (v) => v != null ? `${(v / 1000).toFixed(0)}k` : "—",
    getValue: (a, d) => d.tps_per_agent?.[a] ?? null,
  },
  // Efficiency & Robustness
  {
    key: "jsd",
    group: "robustness",
    label: "JSD",
    desc: "Condition-to-centroid Stability",
    higher: false,
    format: (v) => v != null ? v.toFixed(4) : "—",
    getValue: (a, d) => {
      const pa = d.table2_jsd?.per_agent?.[a];
      if (!pa) return null;
      return pa.centroid_mean;
    },
  },
];

const GROUP_META: Record<string, { label: string; colorClass: string; count: number }> = {
  bias: { label: "Bias Evaluation", colorClass: "text-indigo-500", count: 2 },
  performance: { label: "Attack Performance", colorClass: "text-emerald-500", count: 2 },
  robustness: { label: "Efficiency & Robustness", colorClass: "text-amber-500", count: 1 },
};

interface Props {
  data: PaperSummary;
}

export function LeaderboardTable({ data }: Props) {
  const [sortKey, setSortKey] = useState("entropy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const agents = data.agents;

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0];
    return [...agents].sort((a, b) => {
      const va = col.getValue(a, data) ?? -Infinity;
      const vb = col.getValue(b, data) ?? -Infinity;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [agents, sortKey, sortDir, data]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const groups = ["bias", "performance", "robustness"] as const;

  return (
    <section className="max-w-[1500px] mx-auto px-6">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-foreground">Agent Signatures</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Five frontier agents across {data.n_sessions.s1} free-choice sessions and {data.n_sessions.s2} injection sessions.
          Bias evaluation, attack performance, and robustness metrics are reported side-by-side; click any header to sort.
        </p>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead rowSpan={2} className="text-foreground font-semibold px-5 py-3 align-bottom border-b border-border">Agent</TableHead>
              {groups.map((g, gi) => {
                const meta = GROUP_META[g];
                return (
                  <TableHead
                    key={g}
                    colSpan={meta.count}
                    className={`text-center px-2 pt-3 pb-1 border-b-0${gi > 0 ? " border-l border-border" : ""}`}
                  >
                    <span className={`text-xs font-mono uppercase tracking-wider ${meta.colorClass}`}>{meta.label}</span>
                  </TableHead>
                );
              })}
            </TableRow>
            <TableRow className="border-border hover:bg-transparent">
              {COLUMNS.map((col, i) => {
                const isGroupStart = i === 0 || COLUMNS[i - 1].group !== col.group;
                return (
                  <TableHead
                    key={col.key}
                    className={`text-right text-foreground font-semibold cursor-pointer select-none hover:text-foreground transition-colors px-5 py-3${
                      isGroupStart && i > 0 ? " border-l border-border" : ""
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-xs">{sortDir === "desc" ? "▼" : "▲"}</span>
                      )}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                      {col.desc} {col.higher ? <span className="text-muted-foreground">↑</span> : <span className="text-muted-foreground">↓</span>}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((agent) => (
              <TableRow
                key={agent}
                className="border-border hover:bg-muted transition-colors"
              >
                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <AgentBadge agent={agent} />
                    <div>
                      <span className="font-medium text-foreground">
                        {AGENT_LABELS[agent] ?? agent}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground hidden sm:inline">
                        {AGENT_MODELS[agent] ?? ""}
                      </span>
                    </div>
                  </div>
                </TableCell>
                {COLUMNS.map((col, i) => {
                  const isGroupStart = i === 0 || COLUMNS[i - 1].group !== col.group;
                  return (
                    <TableCell
                      key={col.key}
                      className={`text-right font-mono text-base tabular-nums px-5 py-4${
                        isGroupStart && i > 0 ? " border-l border-border" : ""
                      }`}
                    >
                      {col.format(col.getValue(agent, data))}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function AgentBadge({ agent }: { agent: string }) {
  const icon = AGENT_ICONS[agent];
  const label = AGENT_LABELS[agent] ?? agent;
  if (icon) {
    return (
      <div className="w-7 h-7 rounded-full agent-icon-circle flex items-center justify-center shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt={label} className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full agent-icon-circle flex items-center justify-center shrink-0">
      <span className="text-[10px] font-semibold text-foreground">{label.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}
