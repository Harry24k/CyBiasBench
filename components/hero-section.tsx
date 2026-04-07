const RESEARCHERS = [
  { name: "Taein Lim", affiliation: "Chung-Ang University" },
  { name: "Seongyong Ju", affiliation: "Chung-Ang University" },
  { name: "Munhyeok Kim", affiliation: "Chung-Ang University" },
  { name: "Hyunjun Kim", affiliation: "Myongji University", corresponding: true },
  { name: "Hoki Kim", affiliation: "Chung-Ang University", corresponding: true },
];

export function HeroSection() {
  return (
    <section className="pt-24 pb-16 max-w-[1500px] mx-auto px-6 text-center">
      <h1 className="font-serif text-5xl md:text-6xl text-foreground tracking-tight">
        CyBiasBench
      </h1>
      <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
        Benchmarking Bias in LLM Agents
        <br />
        for Cyber-Attack Scenarios
      </p>
      <p className="mt-6 text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
        Existing benchmarks evaluate agents through ASR alone, collapsing fundamentally different behavioral profiles into a single number.
        CyBiasBench captures how agents select, persist in, and can be steered toward attack strategies.
        3 agents &middot; 3 targets &middot; 2 scenarios &middot; 378 experiments.
      </p>

      <div className="mt-8 flex items-center justify-center gap-4">
        <a
          href="https://github.com/Harry24k/CyBiasBench"
          target="_blank"
          rel="noopener noreferrer"
          className="text-base text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          GitHub
        </a>
      </div>

      <div className="mt-10">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
          Researchers
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {RESEARCHERS.map((r) => (
            <div key={r.name} className="flex flex-col items-center">
              <span className="text-base text-foreground/80">
                {r.name}{r.corresponding && <span className="text-muted-foreground">*</span>}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">{r.affiliation}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-3">* Corresponding Author</p>
      </div>

    </section>
  );
}
