export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-[1500px] mx-auto px-6 py-10">
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
      </div>
    </footer>
  );
}
