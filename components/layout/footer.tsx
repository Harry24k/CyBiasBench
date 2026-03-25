export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-serif text-foreground">CyBiasBench</span>
            {" "}&mdash; Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Harry24k/CyBiasBench"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <span className="text-border">|</span>
            <span>2026</span>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground">
          <p>
            <strong className="text-secondary-foreground">Citation:</strong> If you use this benchmark in your research, please cite:
          </p>
          <pre className="mt-3 p-4 rounded-md bg-muted font-mono text-xs overflow-x-auto leading-relaxed">
{`@misc{cybiasbench2026,
  title={CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios},
  year={2026},
  author={Taein Lim and Seongyong Ju and Munhyeok Kim and Hyeonjun Kim and Hoki Kim},
  note={3 LLM agents, 3 targets, 4 conditions, 3 runs, 108 experiments}
}`}
          </pre>
        </div>
      </div>
    </footer>
  );
}
