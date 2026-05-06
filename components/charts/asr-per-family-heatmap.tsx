"use client";

/**
 * AsrPerFamilyHeatmap
 * --------------------
 * Mirror of paper Table 7 (per-family ASR_i across the 5 agents).
 *
 * Data keys consumed (from PaperSummary):
 *   - agents: string[]                                       (column order)
 *   - families: string[]                                     (row order, canonical)
 *   - fig3_asri_per_agent[agent][family]: number (0-1)       (ASR_i, cell color)
 *   - table1_agent_signatures[agent].top_family: string      (bold cell highlight)
 *
 * Interactivity:
 *   - Hover any cell -> native tooltip with agent, family, ASR_i %, and the
 *     "Most selected family" tag when applicable.
 *   - "Sort families by max ASR_i" toggle reorders rows by the per-family max
 *     ASR_i across agents (descending). Toggle again to restore canonical order.
 *
 * Rendering:
 *   - Plain CSS grid (10 rows x 5 cols of agent cells, plus axes), no PNG/PDF.
 *   - Single-hue blue ramp keyed off the cell's ASR_i in [0, 1]. Bold ring on
 *     each agent's most selected family illustrates Sel_i / ASR_i decoupling.
 */

import { useMemo, useState } from "react";
import { AGENT_LABELS, type PaperSummary } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";

const FAMILY_LABELS: Record<string, string> = {
  sqli: "SQLi",
  xss: "XSS",
  cmdi: "CmdI",
  path_traversal: "Path Traversal",
  auth_bypass: "Auth Bypass",
  idor: "IDOR",
  ssrf: "SSRF",
  csrf: "CSRF",
  file_upload: "File Upload",
  info_disclosure: "Info Disclosure",
};

interface Props {
  data: Pick<
    PaperSummary,
    "agents" | "families" | "fig3_asri_per_agent" | "table1_agent_signatures"
  >;
}

function rampColor(value: number, isLight: boolean): string {
  // Single-hue blue ramp: light theme uses light->dark blues on white,
  // dark theme uses muted blues that read on the card surface.
  const v = Math.max(0, Math.min(1, value));
  if (isLight) {
    // mix from #eff6ff (blue-50) -> #1d4ed8 (blue-700)
    const r = Math.round(239 + (29 - 239) * v);
    const g = Math.round(246 + (78 - 246) * v);
    const b = Math.round(255 + (216 - 255) * v);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // dark: from #0b1220 -> #60a5fa
  const r = Math.round(11 + (96 - 11) * v);
  const g = Math.round(18 + (165 - 18) * v);
  const b = Math.round(32 + (250 - 32) * v);
  return `rgb(${r}, ${g}, ${b})`;
}

function textColor(value: number, isLight: boolean): string {
  const v = Math.max(0, Math.min(1, value));
  if (isLight) return v > 0.55 ? "#ffffff" : "#0f172a";
  return v > 0.45 ? "#ffffff" : "#e5e7eb";
}

export default function AsrPerFamilyHeatmap({ data }: Props) {
  const isLight = useTheme();
  const [sortByMax, setSortByMax] = useState(false);

  const agents = data.agents;
  const families = useMemo(() => {
    if (!sortByMax) return data.families;
    const withMax = data.families.map((f) => {
      const max = Math.max(
        ...agents.map((a) => data.fig3_asri_per_agent?.[a]?.[f] ?? 0),
      );
      return { f, max };
    });
    withMax.sort((a, b) => b.max - a.max);
    return withMax.map((x) => x.f);
  }, [sortByMax, data.families, agents, data.fig3_asri_per_agent]);

  const topByAgent: Record<string, string | undefined> = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const a of agents) m[a] = data.table1_agent_signatures?.[a]?.top_family;
    return m;
  }, [agents, data.table1_agent_signatures]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Per-family ASR (paper Table 7 mirror)
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Cell brightness = ASR_i. Bold cells mark each agent&apos;s most
            selected family; they are NOT the highest-ASR_i cells, illustrating
            Sel_i-ASR_i decoupling.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSortByMax((s) => !s)}
          className="text-xs px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-foreground"
        >
          {sortByMax ? "Canonical family order" : "Sort families by max ASR_i"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-px"
          style={{
            gridTemplateColumns: `minmax(120px, auto) repeat(${agents.length}, minmax(72px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="bg-card text-xs font-semibold text-muted-foreground p-2">
            family \\ agent
          </div>
          {agents.map((a) => (
            <div
              key={`h-${a}`}
              className="bg-card text-xs font-semibold text-foreground p-2 text-center"
            >
              {AGENT_LABELS[a] ?? a}
            </div>
          ))}

          {/* Body rows */}
          {families.map((f) => (
            <FamilyRow
              key={f}
              family={f}
              agents={agents}
              values={agents.map(
                (a) => data.fig3_asri_per_agent?.[a]?.[f] ?? 0,
              )}
              topByAgent={topByAgent}
              isLight={isLight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FamilyRow({
  family,
  agents,
  values,
  topByAgent,
  isLight,
}: {
  family: string;
  agents: string[];
  values: number[];
  topByAgent: Record<string, string | undefined>;
  isLight: boolean;
}) {
  return (
    <>
      <div className="bg-card text-xs font-mono text-muted-foreground p-2 truncate">
        {FAMILY_LABELS[family] ?? family}
      </div>
      {agents.map((a, i) => {
        const v = values[i];
        const isTop = topByAgent[a] === family;
        const tooltip =
          `${AGENT_LABELS[a] ?? a} - ${FAMILY_LABELS[family] ?? family}\n` +
          `ASR_i: ${(v * 100).toFixed(1)}%` +
          (isTop ? "\nMost selected family" : "");
        return (
          <div
            key={`${family}-${a}`}
            title={tooltip}
            className={`p-2 text-center text-xs font-mono ${
              isTop ? "ring-2 ring-foreground/70 z-10 relative" : ""
            }`}
            style={{
              backgroundColor: rampColor(v, isLight),
              color: textColor(v, isLight),
              fontWeight: isTop ? 700 : 500,
            }}
          >
            {(v * 100).toFixed(1)}%
          </div>
        );
      })}
    </>
  );
}
