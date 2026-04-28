"use client";

import { useTheme } from "@/lib/use-theme";

export function InjectionDesignDiagram() {
  const isLight = useTheme();
  const obsBg = isLight ? "#eef2ff" : "#1e1b4b";
  const obsBorder = isLight ? "#6366f1" : "#818cf8";
  const injBg = isLight ? "#fffbeb" : "#451a03";
  const injBorder = isLight ? "#f59e0b" : "#fbbf24";
  const realBg = isLight ? "#ecfdf5" : "#022c22";
  const realBorder = isLight ? "#10b981" : "#34d399";
  const arrowStroke = isLight ? "#475569" : "#94a3b8";
  const labelBg = isLight ? "#fff" : "#0f172a";

  return (
    <div className="rounded-lg border border-border bg-card px-6 pt-10 pb-6">
      <div className="grid grid-cols-[1fr_56px_1fr_56px_1fr] gap-3 items-stretch">
        <Stage
          label="S1 — Bias Observation"
          title="Free-choice traces"
          body="Estimate Selᵢ and ASRᵢ from unrestricted runs."
          bg={obsBg}
          border={obsBorder}
        />
        <Arrow label="prior preference" stroke={arrowStroke} labelBg={labelBg} />
        <Stage
          label="Treatment"
          title="Injected Prompt"
          body="Same environment; one target family named in task focus."
          bg={injBg}
          border={injBorder}
        />
        <Arrow label="external steering" stroke={arrowStroke} labelBg={labelBg} />
        <Stage
          label="S2 — Realized Behavior"
          title="Compliance + Capability"
          body="Measure compliance (manipulation check) and target-restricted ASRᵢ."
          bg={realBg}
          border={realBorder}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <BreakdownChip label="Agents" value="5" />
        <BreakdownChip label="Injected families" value="10" />
        <BreakdownChip label="Targets" value="3" />
        <BreakdownChip label="Repetitions" value="3" />
        <BreakdownChip label="Total runs" value="450" emphasize />
      </div>

      <p className="mt-4 text-xs text-muted-foreground italic">
        Test whether user-specified emphasis overrides the free-choice
        allocation profile, or whether the same allocation bias carries into
        prompted settings.
      </p>
    </div>
  );
}

function Stage({
  label,
  title,
  body,
  bg,
  border,
}: {
  label: string;
  title: string;
  body: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <span
        className="text-[11px] font-mono uppercase tracking-widest"
        style={{ color: border }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground leading-snug">{body}</span>
    </div>
  );
}

function Arrow({
  label,
  stroke,
  labelBg,
}: {
  label: string;
  stroke: string;
  labelBg: string;
}) {
  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox="0 0 56 24"
        className="w-full h-6"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={`arrow-${label.replace(/\s/g, "-")}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
          </marker>
        </defs>
        <line
          x1="2"
          y1="12"
          x2="54"
          y2="12"
          stroke={stroke}
          strokeWidth="1.4"
          markerEnd={`url(#arrow-${label.replace(/\s/g, "-")})`}
        />
      </svg>
      <span
        className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap rounded text-muted-foreground"
        style={{ backgroundColor: labelBg, border: `1px solid ${stroke}33` }}
      >
        {label}
      </span>
    </div>
  );
}

function BreakdownChip({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 px-3 py-2 rounded-md border ${
        emphasize ? "border-foreground/30 bg-muted" : "border-border bg-card"
      }`}
    >
      <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          emphasize ? "text-foreground font-bold text-base" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
