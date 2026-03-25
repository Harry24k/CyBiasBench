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
  MODEL_COLORS,
  AGENT_LABELS,
  AGENT_MODELS,
  AGENT_ICONS,
} from "@/lib/types";
import type { AnalysisResults } from "@/lib/types";

type SortDir = "asc" | "desc";

interface Column {
  key: string;
  label: string;
  desc: string;
  format: (v: number | null) => string;
  getValue: (agent: string, data: AnalysisResults) => number | null;
}

const COLUMNS: Column[] = [
  {
    key: "asr",
    label: "ASR",
    desc: "Attack Success Rate",
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    getValue: (agent, data) => data.aggregated_by_agent[agent]?.overall_asr ?? null,
  },
  {
    key: "entropy",
    label: "H(X)",
    desc: "Technique Entropy",
    format: (v) => v != null ? v.toFixed(2) : "—",
    getValue: (agent, data) => data.aggregated_by_agent[agent]?.shannon_entropy ?? null,
  },
  {
    key: "tps",
    label: "TPS",
    desc: "Tokens per Success",
    format: (v) => {
      if (v == null) return "—";
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
      return `${(v / 1000).toFixed(0)}K`;
    },
    getValue: (agent, data) => data.aggregated_by_agent[agent]?.tokens_per_success ?? null,
  },
  {
    key: "mismatch",
    label: "Mismatch",
    desc: "Wasted Effort Ratio",
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    getValue: (agent, data) => data.aggregated_by_agent[agent]?.avg_mismatch ?? data.aggregated_by_agent[agent]?.avg_hallucinated_attack_bias ?? null,
  },
];

interface LeaderboardTableProps {
  data: AnalysisResults;
}

export function LeaderboardTable({ data }: LeaderboardTableProps) {
  const [sortKey, setSortKey] = useState("asr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const agents = Object.keys(data.aggregated_by_agent);

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

  return (
    <section className="max-w-[1100px] mx-auto px-6">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-foreground">Agent Bias Metrics</h2>
        <p className="mt-2 text-base text-muted-foreground max-w-2xl">
          4 core metrics measuring agent-level strategic bias across 108 experiment sessions.
          H(X) = technique diversity, ASR = attack success rate, TPS = tokens per successful attack,
          Mismatch = wasted effort on zero-success techniques. Click headers to sort.
        </p>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-foreground font-semibold px-5 py-4">Agent</TableHead>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-right text-foreground font-semibold cursor-pointer select-none hover:text-white transition-colors px-5 py-4"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-xs">{sortDir === "desc" ? "▼" : "▲"}</span>
                    )}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                    {col.desc}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((agent) => (
              <TableRow
                key={agent}
                className="border-border hover:bg-[#1a1a1e] transition-colors"
              >
                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${process.env.NODE_ENV === "production" ? "/CyBiasBench" : ""}${AGENT_ICONS[agent] ?? ""}`}
                        alt={agent}
                        className="w-4 h-4"
                      />
                    </div>
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
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.key}
                    className="text-right font-mono text-base tabular-nums px-5 py-4"
                  >
                    {col.format(col.getValue(agent, data))}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
