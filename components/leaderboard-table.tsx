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
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

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
  descKo: string;
  higher: boolean;
  format: (v: number | null) => string;
  getValue: (agent: string, data: PaperSummary) => number | null;
}

const COLUMNS: Column[] = [
  {
    key: "entropy",
    group: "bias",
    label: "H(X)",
    desc: "Attack-Family Entropy",
    descKo: "공격 계열 엔트로피",
    higher: true,
    format: (v) => v != null ? v.toFixed(2) : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.entropy ?? null,
  },
  {
    key: "top_sel",
    group: "bias",
    label: "Top Selᵢ",
    desc: "Most Selected Family Share",
    descKo: "최다 선택 계열 비중",
    higher: false,
    format: (v) => v != null ? `${v.toFixed(1)}%` : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.top_share ?? null,
  },
  {
    key: "session_asr",
    group: "performance",
    label: "ASR",
    desc: "Session Attack Success Rate",
    descKo: "세션 공격 성공률",
    higher: true,
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    getValue: (a, d) => d.table1_agent_signatures[a]?.session_asr_mean ?? null,
  },
  {
    key: "tps",
    group: "robustness",
    label: "TPS",
    desc: "Tokens Per Success",
    descKo: "성공당 토큰",
    higher: false,
    format: (v) => v != null ? `${(v / 1000).toFixed(0)}k` : "—",
    getValue: (a, d) => d.tps_per_agent?.[a] ?? null,
  },
  {
    key: "jsd",
    group: "robustness",
    label: "JSD",
    desc: "Condition-to-centroid Stability",
    descKo: "조건–중심 간 안정성",
    higher: false,
    format: (v) => v != null ? v.toFixed(4) : "—",
    getValue: (a, d) => {
      const pa = d.table2_jsd?.per_agent?.[a];
      if (!pa) return null;
      return pa.centroid_mean;
    },
  },
];

const GROUP_META: Record<
  string,
  { label: string; labelKo: string; colorClass: string; count: number }
> = {
  bias: { label: "Bias Evaluation", labelKo: "편향 평가", colorClass: "text-indigo-500", count: 2 },
  performance: { label: "Attack Performance", labelKo: "공격 성능", colorClass: "text-emerald-500", count: 1 },
  robustness: { label: "Efficiency & Robustness", labelKo: "효율성과 견고성", colorClass: "text-amber-500", count: 2 },
};

interface Props {
  data: PaperSummary;
}

export function LeaderboardTable({ data }: Props) {
  const t = useT();
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
    <section className="max-w-[1500px] mx-auto px-4 sm:px-6">
      <div className="mb-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          {t("Agent Signatures", "에이전트 시그니처")}
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          {t(
            <>
              Five frontier agents across {data.n_sessions.s1} free-choice sessions and {data.n_sessions.s2} injection sessions.
              Bias evaluation, attack performance, and robustness metrics are reported side-by-side; click any header to sort,
              or click ▾ on a row to inspect that agent&apos;s full Sel<sub>i</sub> profile.
            </>,
            <>
              프런티어 에이전트 5종을 자유 선택 세션 {data.n_sessions.s1}회와 주입 세션{" "}
              {data.n_sessions.s2}회에 걸쳐 평가함. 편향 평가·공격 성능·견고성 지표를 나란히
              보여줌. 열 제목을 누르면 정렬되고, 행의 ▾를 누르면 해당 에이전트의 전체
              Sel<sub>i</sub> 프로파일을 볼 수 있음.
            </>
          )}
        </p>
      </div>

      {/* Mobile: stacked agent cards (no horizontal scroll) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="leaderboard-sort"
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0"
          >
            {t("Sort", "정렬")}
          </label>
          <select
            id="leaderboard-sort"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [string, SortDir];
              setSortKey(k);
              setSortDir(d);
            }}
            className="flex-1 min-w-0 max-w-full text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground truncate"
          >
            {COLUMNS.map((c) => (
              <Fragment key={c.key}>
                <option value={`${c.key}:desc`}>
                  {t(c.desc, c.descKo)} ({c.label}){" "}
                  {c.higher
                    ? t("high → low", "높은 순")
                    : t("low → high", "낮은 순")}
                </option>
                <option value={`${c.key}:asc`}>
                  {t(c.desc, c.descKo)} ({c.label}){" "}
                  {c.higher
                    ? t("low → high", "낮은 순")
                    : t("high → low", "높은 순")}
                </option>
              </Fragment>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-border divide-y divide-border bg-card overflow-hidden">
          {sorted.map((agent) => (
            <MobileLeaderboardCard
              key={agent}
              agent={agent}
              data={data}
              expanded={expanded === agent}
              onToggle={() => setExpanded(expanded === agent ? null : agent)}
            />
          ))}
        </div>
      </div>

      {/* Desktop: full sortable table */}
      <div className="hidden md:block rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead rowSpan={2} className="text-foreground font-semibold px-5 py-3 align-bottom border-b border-border">
                {t("Agent", "에이전트")}
              </TableHead>
              {groups.map((g, gi) => {
                const meta = GROUP_META[g];
                return (
                  <TableHead
                    key={g}
                    colSpan={meta.count}
                    className={`text-center px-2 pt-3 pb-1 border-b-0${gi > 0 ? " border-l border-border" : ""}`}
                  >
                    <span className={`text-xs font-mono uppercase tracking-wider ${meta.colorClass}`}>
                      {t(meta.label, meta.labelKo)}
                    </span>
                  </TableHead>
                );
              })}
              <TableHead rowSpan={2} className="border-b border-border w-12" aria-label={t("expand", "펼치기")} />
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
                      {t(col.desc, col.descKo)} {col.higher ? <span className="text-muted-foreground">↑</span> : <span className="text-muted-foreground">↓</span>}
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
  const t = useT();
  const sig = data.table1_agent_signatures[agent];
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const tps = data.tps_per_agent?.[agent] ?? null;
  const jsd = data.table2_jsd?.per_agent?.[agent]?.centroid_mean ?? null;

  return (
    <Fragment>
      <TableRow
        className={cn(
          "border-border transition-colors cursor-pointer",
          expanded ? "bg-muted/40 hover:bg-muted/40" : "hover:bg-muted",
        )}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={t(
          `${expanded ? "Collapse" : "Expand"} ${AGENT_LABELS[agent] ?? agent} selection profile`,
          `${AGENT_LABELS[agent] ?? agent} 선택 프로파일 ${expanded ? "접기" : "펼치기"}`
        )}
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
          const value = col.format(col.getValue(agent, data));
          return (
            <TableCell
              key={col.key}
              className={`text-right font-mono text-base tabular-nums px-5 py-4 ${
                isGroupStart && i > 0 ? "border-l border-border " : ""
              }`}
            >
              {value}
            </TableCell>
          );
        })}
        <TableCell className="px-3 py-4 text-center" aria-hidden="true">
          <span
            className={cn(
              "inline-block text-sm text-muted-foreground transition-transform",
              expanded && "rotate-180 text-foreground",
            )}
          >
            ▾
          </span>
        </TableCell>
      </TableRow>
      {expanded && sig && (
        <TableRow className="border-border bg-muted/[0.18] hover:bg-muted/[0.18]">
          <TableCell colSpan={COLUMNS.length + 2} className="px-6 py-5">
            <LeaderboardDetailsPanel
              agent={agent}
              color={color}
              sig={sig}
              tps={tps}
              jsd={jsd}
              selByFamily={data.fig3_selection_per_agent[agent] ?? {}}
              families={data.families}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function LeaderboardDetailsPanel({
  agent,
  color,
  sig,
  tps,
  jsd,
  selByFamily,
  families,
}: {
  agent: string;
  color: string;
  sig: NonNullable<PaperSummary["table1_agent_signatures"][string]>;
  tps: number | null;
  jsd: number | null;
  selByFamily: Record<string, number>;
  families: string[];
}) {
  const t = useT();
  const topFamilyLabel = FAMILY_LABELS[sig.top_family] ?? sig.top_family;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="font-semibold text-foreground">
                {AGENT_LABELS[agent] ?? agent} {t("Agent Signature", "에이전트 시그니처")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "Selection profile and full metric summary from free-choice sessions.",
                  "자유 선택 세션에서 얻은 선택 프로파일과 전체 지표 요약임."
                )}
              </p>
            </div>
          </div>
          <span
            className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground tabular-nums"
          >
            {t("Top", "최다")} {topFamilyLabel} · {sig.top_share.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-lg border border-border bg-background/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("Sel", "계열별 Sel")}<sub>i</sub>{t(" by Family", "")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("Top family", "최다 선택 계열")}: <span className="text-foreground">{topFamilyLabel}</span>{" "}
                <span className="font-mono tabular-nums">
                  ({sig.top_share.toFixed(1)}%)
                </span>
              </p>
            </div>
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground tabular-nums">
              {t("10 families", "10개 계열")}
            </span>
          </div>
          <MiniFamilyBars
            selByFamily={selByFamily}
            families={families}
            familyLabels={FAMILY_LABELS}
            color={color}
            height={300}
            highlightFamily={sig.top_family}
          />
        </div>

        <div className="rounded-lg border border-border bg-background/30 p-4">
          <p className="text-sm font-semibold text-foreground">{t("Full Metrics", "전체 지표")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(
              "Bias, performance, and robustness indicators for this agent.",
              "이 에이전트의 편향·성능·견고성 지표임."
            )}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="H(X)" value={sig.entropy.toFixed(2)} />
            <StatTile label="Top Selᵢ" value={`${sig.top_share.toFixed(1)}%`} />
            <StatTile label={t("Session ASR", "세션 ASR")} value={`${(sig.session_asr_mean * 100).toFixed(1)}%`} />
            <StatTile label={t("Unique / Session", "고유 / 세션")} value={sig.unique_techniques.toFixed(2)} />
            <StatTile
              label={t("Selection CR1", "선택 CR1")}
              value={sig.selection_cr1 != null ? `${sig.selection_cr1.toFixed(1)}%` : "—"}
            />
            <StatTile
              label="TPS"
              value={
                tps != null
                  ? tps >= 1000
                    ? `${(tps / 1000).toFixed(1)}k`
                    : tps.toFixed(0)
                  : "—"
              }
            />
            <StatTile label="JSD" value={jsd != null ? jsd.toFixed(4) : "—"} />
            <StatTile label={t("Sessions", "세션 수")} value={String(sig.n_sessions)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/25 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function MobileLeaderboardCard({
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
  const t = useT();
  const sig = data.table1_agent_signatures[agent];
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";

  return (
    <div className="bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 active:bg-muted/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <AgentBadge agent={agent} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground truncate">
              {AGENT_LABELS[agent] ?? agent}
            </div>
            <div className="text-xs text-muted-foreground font-mono truncate">
              {AGENT_MODELS[agent] ?? ""}
            </div>
          </div>
          <span
            className={cn(
              "text-xs text-muted-foreground transition-transform inline-block",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {COLUMNS.map((col) => {
            const meta = GROUP_META[col.group];
            const v = col.getValue(agent, data);
            return (
              <div
                key={col.key}
                className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[10px] font-mono uppercase tracking-wider", meta.colorClass)}>
                    {col.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {col.higher ? "↑" : "↓"}
                  </span>
                </div>
                <div className="mt-0.5 font-mono tabular-nums text-base text-foreground">
                  {col.format(v)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t(col.desc, col.descKo)}
                </div>
              </div>
            );
          })}
        </div>
      </button>
      {expanded && sig && (
        <div className="px-4 pb-4 -mt-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            {t("Sel", "계열별 Sel")}<sub>i</sub>{t(" by family", "")}
          </div>
          <MiniFamilyBars
            selByFamily={data.fig3_selection_per_agent[agent] ?? {}}
            families={data.families}
            familyLabels={FAMILY_LABELS}
            color={color}
            height={220}
            highlightFamily={sig.top_family}
          />
        </div>
      )}
    </div>
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
