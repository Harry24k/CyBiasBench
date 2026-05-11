import { RESEARCHERS, IS_ANONYMOUS } from "@/lib/config";

// Inline literal so Next.js' build-time replacement of NEXT_PUBLIC_* vars
// turns this into a constant boolean, letting the bundler dead-code-eliminate
// the entire venue eyebrow (string included) on the GitHub Pages build.
const VENUE_VISIBLE_INLINE = process.env.NEXT_PUBLIC_DEPLOY_TARGET !== "github";

export function HeroSection() {
  return (
    <section className="pt-10 sm:pt-24 pb-8 sm:pb-16 max-w-[1500px] mx-auto px-4 sm:px-6 text-center">
      {VENUE_VISIBLE_INLINE && (
        <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-3 sm:mb-4">
          NeurIPS 2026 · Evaluations &amp; Datasets Track
        </p>
      )}
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight bg-gradient-to-b from-foreground to-foreground/75 bg-clip-text text-transparent">
        CyBiasBench
      </h1>
      <p className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
        Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
      </p>

      <p className="mt-6 sm:mt-8 text-base sm:text-lg text-foreground/90 max-w-2xl mx-auto leading-snug text-balance">
        <strong className="text-foreground">Same target, same task — but each agent reaches for a different attack.</strong>{" "}
        And forcing an agent off its preference{" "}
        <strong className="text-foreground">drops</strong> attack success, not raises it.
      </p>

      {/* Headline stat strip — four numbers, paper-grounded */}
      <div className="mt-7 sm:mt-9 mx-auto max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Stat
          eyebrow="η²(H)"
          value="0.43"
          caption="agent identity on attack-family entropy"
          tone="bias"
        />
        <Stat
          eyebrow="η²(ASR)"
          value="0.05"
          caption="agent identity on session ASR"
          tone="performance"
        />
        <Stat
          eyebrow="ρ transfer"
          value="+0.70"
          caption="per-family ASR carries across settings"
          tone="performance"
        />
        <Stat
          eyebrow="ΔASR"
          value="≤ 0"
          caption="bias injection · all 5 agents"
          tone="injection"
        />
      </div>

      <p className="mt-6 text-[11px] sm:text-xs font-mono text-muted-foreground/80">
        5 agents &middot; 3 targets &middot; 4 prompt conditions &middot; 630 sessions
      </p>

      <div className="mt-10 sm:mt-12">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
          {IS_ANONYMOUS ? "Authors (anonymized for review)" : "Authors"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:gap-x-8">
          {RESEARCHERS.map((r) => (
            <div key={r.name} className="flex flex-col items-center">
              <span className="text-base text-foreground/90">
                {r.name}
                {r.equal && <sup className="text-muted-foreground ml-0.5">*</sup>}
                {r.corresponding && <sup className="text-muted-foreground ml-0.5">†</sup>}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">{r.affiliation}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">
          <sup>*</sup> Equal contribution &nbsp;·&nbsp; <sup>†</sup> Corresponding authors
        </p>
      </div>
    </section>
  );
}

function Stat({
  eyebrow,
  value,
  caption,
  tone,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  tone: "bias" | "performance" | "efficiency" | "injection";
}) {
  const accent =
    tone === "bias"
      ? "text-indigo-400"
      : tone === "performance"
      ? "text-emerald-400"
      : tone === "efficiency"
      ? "text-amber-400"
      : "text-rose-400";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3 sm:py-4 text-left">
      <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider ${accent}`}>
        {eyebrow}
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-foreground leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] sm:text-[11px] text-muted-foreground leading-tight">
        {caption}
      </div>
    </div>
  );
}
