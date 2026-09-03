"use client";

import { useTheme } from "@/lib/use-theme";
import { useT } from "@/lib/i18n";

export function InjectionDesignDiagram() {
  const t = useT();
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
    <div className="rounded-lg border border-border bg-card px-4 sm:px-6 pt-8 sm:pt-10 pb-6">
      <div className="grid grid-cols-1 gap-3 items-stretch sm:grid-cols-[1fr_56px_1fr_56px_1fr]">
        <Stage
          label={t("Bias Observation", "편향 관찰")}
          title={t("Free-choice traces", "자유 선택 기록")}
          body={t(
            "Estimate Selᵢ and ASRᵢ from unrestricted runs.",
            "제약 없는 실행에서 Selᵢ와 ASRᵢ를 추정함."
          )}
          bg={obsBg}
          border={obsBorder}
        />
        <Arrow
          id="prior-preference"
          label={t("prior preference", "사전 선호")}
          stroke={arrowStroke}
          labelBg={labelBg}
        />
        <Stage
          label={t("Treatment", "처치")}
          title={t("Injected Prompt", "주입 프롬프트")}
          body={t(
            "Same environment; one target family named in task focus.",
            "환경은 동일하고, 과제 진술문에 목표 계열 하나를 지정함."
          )}
          bg={injBg}
          border={injBorder}
        />
        <Arrow
          id="external-steering"
          label={t("external steering", "외부 지시")}
          stroke={arrowStroke}
          labelBg={labelBg}
        />
        <Stage
          label={t("Realized Behavior", "실현된 행동")}
          title={t("Compliance + Capability", "순응도 + 실력")}
          body={t(
            "Measure compliance (manipulation check) and target-restricted ASRᵢ.",
            "순응도(조작 점검)와 목표 한정 ASRᵢ를 측정함."
          )}
          bg={realBg}
          border={realBorder}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
        <BreakdownChip label={t("Agents", "에이전트")} value="5" />
        <BreakdownChip label={t("Injected families", "주입 계열")} value="10" />
        <BreakdownChip label={t("Targets", "표적")} value="3" />
        <BreakdownChip label={t("Repetitions", "반복")} value="3" />
        <BreakdownChip label={t("Total runs", "총 실행")} value="450" emphasize />
      </div>

      <p className="mt-4 text-xs text-muted-foreground italic">
        {t(
          "Test whether user-specified emphasis overrides the free-choice allocation profile, or whether the same allocation bias carries into prompted settings.",
          "사용자가 준 강조가 자유 선택 배분 프로파일을 덮어쓰는지, 아니면 같은 배분 편향이 지시받은 상황까지 그대로 이어지는지를 봄."
        )}
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
  id,
  label,
  stroke,
  labelBg,
}: {
  id: string;
  label: string;
  stroke: string;
  labelBg: string;
}) {
  // Marker ids come from the language-independent `id` so switching locale
  // never rewrites the SVG references.
  const markerId = `arrow-${id}`;
  return (
    <>
      {/* Mobile: vertical arrow with inline label */}
      <div className="sm:hidden flex items-center justify-center gap-2 py-0.5">
        <svg viewBox="0 0 24 32" width="14" height="20" aria-hidden="true">
          <defs>
            <marker
              id={`${markerId}-v`}
              viewBox="0 0 10 10"
              refX="5"
              refY="8"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
            </marker>
          </defs>
          <line
            x1="12"
            y1="2"
            x2="12"
            y2="28"
            stroke={stroke}
            strokeWidth="1.4"
            markerEnd={`url(#${markerId}-v)`}
          />
        </svg>
        <span
          className="px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap rounded text-muted-foreground"
          style={{ backgroundColor: labelBg, border: `1px solid ${stroke}33` }}
        >
          {label}
        </span>
      </div>

      {/* Desktop: horizontal arrow with floating label */}
      <div className="hidden sm:flex relative items-center justify-center">
        <svg
          viewBox="0 0 56 24"
          className="w-full h-6"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={markerId}
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
            markerEnd={`url(#${markerId})`}
          />
        </svg>
        <span
          className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap rounded text-muted-foreground"
          style={{ backgroundColor: labelBg, border: `1px solid ${stroke}33` }}
        >
          {label}
        </span>
      </div>
    </>
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
