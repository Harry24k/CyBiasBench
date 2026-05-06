"use client";

import { useState, useMemo, Fragment } from "react";
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
import { MiniFamilyBars } from "@/components/charts/mini-radar";
import { useAgentColors } from "@/lib/use-theme";

type SortDir = "asc" | "desc";

const FAMILY_LABELS: Record<string, string> = {
  sqli: "SQLi",
  xss: "XSS",
  cmdi: "CmdI",
  path_traversal: "PathTrav",
  auth_bypass: "AuthBypass",
  idor: "IDOR",
  ssrf: "SSRF",
  csrf: "CSRF",
  file_upload: "FileUp",
  info_disclosure: "InfoDisc",
};

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
  const [expanded, setExpanded] = useState<string | null>(null);

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
          Bias evaluation, attack performance, and robustness metrics are reported side-by-side; click any header to sort,
          or click ▾ on a row to inspect that agent&apos;s full Sel<sub>i</sub> profile.
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
              <TableHead rowSpan={2} className="border-b border-border w-12" aria-label="expand" />
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
              <LeaderboardRow
                key={agent}
                agent={agent}
                data={data}
                expanded={expanded === agent}
                onToggle={() => setExpanded(expanded === agent ? null : agent)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function LeaderboardRow({
  agent,
  data,
  expanded,
  onToggle,
}: {
  agent: string;
  data: PaperSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  const sig = data.table1_agent_signatures[agent];
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const tps = data.tps_per_agent?.[agent] ?? null;
  const jsdAgent = data.table2_jsd?.per_agent?.[agent];

  return (
    <Fragment>
      <TableRow className="border-border hover:bg-muted transition-colors">
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
          const isTopSel = col.key === "top_sel";
          return (
            <TableCell
              key={col.key}
              className={`text-right font-mono text-base tabular-nums px-5 py-4 ${
                isGroupStart && i > 0 ? "border-l border-border " : ""
              }${isTopSel ? "relative" : ""}`}
              onMouseEnter={isTopSel ? () => setHover(true) : undefined}
              onMouseLeave={isTopSel ? () => setHover(false) : undefined}
            >
              {col.format(col.getValue(agent, data))}
              {isTopSel && hover && sig && (
                <div
                  className="absolute z-50 right-0 top-full mt-1 bg-card border border-border rounded-md p-3 shadow-lg text-xs text-left w-[260px] pointer-events-none"
                  role="tooltip"
                >
                  <div className="font-semibold text-foreground mb-2">
                    {AGENT_LABELS[agent] ?? agent} · full metrics
                  </div>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-mono tabular-nums">
                    <dt className="text-muted-foreground">H(X)</dt>
                    <dd className="text-foreground">{sig.entropy.toFixed(2)}</dd>
                    <dt className="text-muted-foreground">Unique / session</dt>
                    <dd className="text-foreground">
                      {sig.unique_techniques.toFixed(2)}
                    </dd>
                    <dt className="text-muted-foreground">Selection CR1</dt>
                    <dd className="text-foreground">
                      {sig.selection_cr1 != null
                        ? `${sig.selection_cr1.toFixed(1)}%`
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">
                      Top Sel<sub>i</sub> ({sig.top_family})
                    </dt>
                    <dd className="text-foreground">
                      {sig.top_share.toFixed(1)}%
                    </dd>
                    <dt className="text-muted-foreground">Session ASR</dt>
                    <dd className="text-foreground">
                      {(sig.session_asr_mean * 100).toFixed(1)}%
                    </dd>
                    {tps != null && (
                      <>
                        <dt className="text-muted-foreground">TPS</dt>
                        <dd className="text-foreground">
                          {tps >= 1000
                            ? `${(tps / 1000).toFixed(1)}k`
                            : tps.toFixed(0)}
                        </dd>
                      </>
                    )}
                    {jsdAgent?.centroid_mean != null && (
                      <>
                        <dt className="text-muted-foreground">JSD (within)</dt>
                        <dd className="text-foreground">
                          {jsdAgent.centroid_mean.toFixed(4)}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </TableCell>
          );
        })}
        <TableCell className="px-3 py-4 text-center">
          <button
            type="button"
            onClick={onToggle}
            className="text-sm font-medium px-2 py-1 rounded-md border border-border hover:bg-muted transition-colors"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${
              AGENT_LABELS[agent] ?? agent
            } selection profile`}
          >
            <span className="inline-block transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
              ▾
            </span>
          </button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={COLUMNS.length + 2} className="px-6 py-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Sel<sub>i</sub> by family — {AGENT_LABELS[agent] ?? agent}
            </div>
            <div className="max-w-[600px]">
              <MiniFamilyBars
                selByFamily={data.fig3_selection_per_agent[agent] ?? {}}
                families={data.families}
                familyLabels={FAMILY_LABELS}
                color={color}
                height={220}
                highlightFamily={sig?.top_family}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
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
