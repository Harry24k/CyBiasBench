"use client";

import {
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { useChartColors, useTheme, useAgentColors } from "@/lib/use-theme";
import { AGENT_LABELS, TARGET_LABELS } from "@/lib/types";
import { useT } from "@/lib/i18n";
import type { ScatterPoint } from "@/lib/types";

interface Props {
  agent: string;
  points: ScatterPoint[];
  rho: number;
  pValue: number;
  height?: number;
  showRegression?: boolean;
}

const SUPER_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺",
};
function toSuper(s: string): string {
  return s.split("").map((c) => SUPER_MAP[c] ?? c).join("");
}
function formatP(p: number): string {
  if (p < 1e-3) {
    const exp = p.toExponential(2);
    const [m, e] = exp.split("e");
    return `${m}× 10${toSuper(String(parseInt(e, 10)))}`;
  }
  return p.toFixed(3);
}

// Ordinary least-squares linear fit: y = m*x + b, returning endpoints over given x-domain.
function linearFit(
  pts: { x: number; y: number }[],
  xMin: number,
  xMax: number,
): { x: number; y: number }[] | null {
  if (pts.length < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { x, y } of pts) {
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const n = pts.length;
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [
    { x: xMin, y: clamp(m * xMin + b) },
    { x: xMax, y: clamp(m * xMax + b) },
  ];
}

const CONDITION_LABELS: Record<string, string> = {
  UU: "Unguided · Unstructured",
  US: "Unguided · Structured",
  GU: "Guided · Unstructured",
  GS: "Guided · Structured",
};

const CONDITION_LABELS_KO: Record<string, string> = {
  UU: "비유도 · 비구조",
  US: "비유도 · 구조",
  GU: "유도 · 비구조",
  GS: "유도 · 구조",
};

export function EntropyAsrScatter({
  agent,
  points,
  rho,
  pValue,
  height = 240,
  showRegression = false,
}: Props) {
  const t = useT();
  const colors = useChartColors();
  const isLight = useTheme();
  const agentColors = useAgentColors();
  const color = agentColors[agent] ?? "#888";
  const label = AGENT_LABELS[agent] ?? agent;
  const sig = pValue < 0.05;

  const xMin = 0;
  const xMax = 3.4;

  // Fit using observed x range so the line spans actual data, not full axis.
  const xs = points.map((p) => p.entropy);
  const dataMinX = xs.length ? Math.min(...xs) : xMin;
  const dataMaxX = xs.length ? Math.max(...xs) : xMax;
  const fit =
    showRegression
      ? linearFit(
          points.map((p) => ({ x: p.entropy, y: p.session_asr })),
          dataMinX,
          dataMaxX,
        )
      : null;

  // Combine scatter points and (optional) line endpoints into a single dataset
  // for a ComposedChart so XAxis is shared.
  const lineData = fit
    ? fit.map((pt) => ({ entropy: pt.x, fit_y: pt.y }))
    : [];

  interface TooltipPayloadItem {
    payload?: ScatterPoint & { fit_y?: number };
    name?: string | number;
    dataKey?: string | number;
  }

  const renderScatterTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly TooltipPayloadItem[];
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    // Prefer scatter payload (with session_id) over fit line payload.
    const item =
      payload.find((p) => p.payload && (p.payload as ScatterPoint).session_id) ??
      payload[0];
    const d = item?.payload as ScatterPoint | undefined;
    if (!d || !d.session_id) {
      // Fit line hover
      const fy = (item?.payload as { fit_y?: number; entropy?: number })?.fit_y;
      const ex = (item?.payload as { entropy?: number })?.entropy;
      if (typeof fy !== "number") return null;
      return (
        <div
          className="rounded-md text-xs leading-tight"
          style={{
            backgroundColor: colors.tooltipBg,
            color: colors.tooltipText,
            border: `1px solid ${colors.tooltipBorder}`,
            padding: "6px 8px",
          }}
        >
          <div className="font-mono tabular-nums">
            {t("Fit", "적합")}: H={(ex ?? 0).toFixed(2)} → ASR={((fy ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
      );
    }
    const cond = d.condition
      ? t(CONDITION_LABELS, CONDITION_LABELS_KO)[d.condition] ?? d.condition
      : null;
    const victim = d.victim ? TARGET_LABELS[d.victim] ?? d.victim : null;
    return (
      <div
        className="rounded-md text-xs leading-tight"
        style={{
          backgroundColor: colors.tooltipBg,
          color: colors.tooltipText,
          border: `1px solid ${colors.tooltipBorder}`,
          padding: "8px 10px",
          minWidth: 180,
        }}
      >
        <div className="font-semibold mb-1.5 truncate" style={{ color }}>
          {d.session_id}
        </div>
        <div className="font-mono tabular-nums space-y-0.5">
          <div>H(X) = {d.entropy.toFixed(3)}</div>
          <div>ASR = {(d.session_asr * 100).toFixed(1)}%</div>
        </div>
        {(cond || victim) && (
          <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
            {victim && <div>{t("Target", "표적")}: {victim}</div>}
            {cond && <div>{t("Condition", "조건")}: {cond}</div>}
          </div>
        )}
      </div>
    );
  };

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
          {sig ? " *" : t(" n.s.", " 유의하지 않음")}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            type="number"
            dataKey="entropy"
            name="H(X)"
            domain={[xMin, xMax]}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: t("Session entropy H(X)", "세션 엔트로피 H(X)"),
              position: "insideBottom",
              offset: -8,
              style: { fontSize: 12, fill: colors.tick },
            }}
            allowDuplicatedCategory={false}
          />
          <YAxis
            type="number"
            dataKey="session_asr"
            name="ASR"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 12, fill: colors.tick }}
            label={{
              value: t("Session ASR", "세션 ASR"),
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: colors.tick },
            }}
          />
          <ZAxis range={[35, 35]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: colors.grid }}
            content={renderScatterTooltip}
          />
          <Scatter
            data={points}
            fill={color}
            fillOpacity={isLight ? 0.75 : 0.55}
          />
          {fit && (
            <Line
              data={lineData}
              dataKey="fit_y"
              type="linear"
              stroke={color}
              strokeWidth={1.75}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
