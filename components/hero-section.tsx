const RESEARCHERS = [
  "Taein Lim",
  "Seongyong Ju",
  "Munhyeok Kim",
  "Hyeonjun Kim",
  "Hoki Kim",
];

export function HeroSection() {
  return (
    <section className="pt-24 pb-16 max-w-[1100px] mx-auto px-6 text-center">
      <h1 className="font-serif text-5xl md:text-6xl text-foreground tracking-tight">
        CyBiasBench
      </h1>
      <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        Benchmarking Bias in LLM Agents
        <br />
        for Cyber-Attack Scenarios
      </p>
      <p className="mt-6 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
        A systematic evaluation of behavioral biases across LLM agents
        performing cyber-attack tasks against vulnerable applications.
        3 agents &middot; 3 targets &middot; 4 conditions &middot; 108 experiments.
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
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {RESEARCHERS.map((name) => (
            <span key={name} className="text-base text-zinc-300">
              {name}
            </span>
          ))}
        </div>
      </div>

    </section>
  );
}
