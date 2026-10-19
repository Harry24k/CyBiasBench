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
import { useT, type Lang } from "@/lib/i18n";

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

interface RadarDatum {
  metric: string;
  selNorm: number;
  asrNorm: number;
  selRaw: number;
  asrRaw: number;
}

function classifyCell(selRaw: number, asrRaw: number, lang: Lang): {
  label: string;
  tone: string;
} {
  const ko = lang === "ko";
  // High selection, low ASR -> mis-spent effort
  if (selRaw >= 0.15 && asrRaw < 0.25) {
    return {
      label: ko ? "집중했지만 성과 낮음" : "focus, low payoff",
      tone: "text-amber-600 dark:text-amber-400",
    };
  }
  // Low selection, high ASR -> capability ignored
  if (selRaw < 0.08 && asrRaw >= 0.4) {
    return {
      label: ko ? "활용되지 않은 실력" : "underused capability",
      tone: "text-emerald-600 dark:text-emerald-400",
    };
  }
  // Low selection AND low ASR -> blind spot
  if (selRaw < 0.05 && asrRaw < 0.15) {
    return {
      label: ko ? "사각지대" : "blind spot",
      tone: "text-rose-600 dark:text-rose-400",
    };
  }
  // High selection AND high ASR -> aligned focus
  if (selRaw >= 0.15 && asrRaw >= 0.4) {
    return {
      label: ko ? "선택과 실력이 일치" : "aligned focus",
      tone: "text-sky-600 dark:text-sky-400",
    };
  }
  return { label: ko ? "중간" : "moderate", tone: "text-muted-foreground" };
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
  const t = useT();
  const lang = t<Lang>("en", "ko");
  const colors = useChartColors();
  const isLight = useTheme();
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const label = AGENT_LABELS[agent] ?? agent;
  const priorColor = isLight ? "#52525b" : "#a1a1aa";

  const data: RadarDatum[] = families.map((f) => {
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

  // Custom tooltip: combines both rings into one block by family axis.
  interface TooltipPayloadItem {
    payload?: RadarDatum;
  }
  const renderRadarTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly TooltipPayloadItem[];
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const cls = classifyCell(d.selRaw, d.asrRaw, lang);
    return (
      <div
        className="rounded-md text-sm leading-snug"
        style={{
          backgroundColor: colors.tooltipBg,
          color: colors.tooltipText,
          border: `1px solid ${colors.tooltipBorder}`,
          padding: "12px 14px",
          minWidth: 220,
        }}
      >
        <div className="font-semibold mb-2 text-base" style={{ color }}>
          {d.metric}
        </div>
        <div className="font-mono tabular-nums space-y-1 text-[13px]">
          <div>
            {t("Selection share", "선택 비중")}{" "}
            <span style={{ color }}>{(d.selRaw * 100).toFixed(1)}%</span>
          </div>
          <div>
            {t("Attack success rate", "공격 성공률")}{" "}
            <span>{(d.asrRaw * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div className={`mt-2 text-xs ${cls.tone}`}>{cls.label}</div>
      </div>
    );
  };

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
            <span style={{ color }}>{t("Top selection share", "최고 선택 비중")}</span>{" "}
            {(topSel.v * 100).toFixed(1)}% ·{" "}
            {familyLabels?.[topSel.f] ?? topSel.f}
          </div>
          <div>
            {t("Top success rate", "최고 공격 성공률")} {(topAsr.v * 100).toFixed(1)}% ·{" "}
            {familyLabels?.[topAsr.f] ?? topAsr.f}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 10, fill: colors.tick }}
          />
          <PolarRadiusAxis
            tick={false}
            axisLine={false}
            domain={[0, 1]}
            tickCount={4}
          />
          <Tooltip content={renderRadarTooltip} />
          <Radar
            name="asrNorm"
            dataKey="asrNorm"
            stroke={priorColor}
            fill={priorColor}
            fillOpacity={0.12}
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
