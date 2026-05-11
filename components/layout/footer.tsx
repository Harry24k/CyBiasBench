import { SITE, REPO, PAPER, IS_ANONYMOUS, VENUE_VISIBLE } from "@/lib/config";
import { BASE_PATH } from "@/lib/utils";

export function Footer() {
  const paperHref = PAPER.pdfPath ? `${BASE_PATH}${PAPER.pdfPath}` : null;

  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-10 space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="font-serif text-foreground">{SITE.name}</span>
            {" "}&mdash; Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
            {paperHref ? (
              <a
                href={paperHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {PAPER.label}
              </a>
            ) : (
              <span className="text-muted-foreground/60">{PAPER.label}</span>
            )}
            {REPO.url ? (
              <a
                href={REPO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {REPO.label}
              </a>
            ) : (
              <span className="text-muted-foreground/60">{REPO.label}</span>
            )}
            <span>License: {SITE.license}</span>
            <span>{SITE.year}</span>
          </div>
        </div>
        {VENUE_VISIBLE ? (
          <p className="text-[11px] text-muted-foreground/70">
            {IS_ANONYMOUS
              ? "Anonymous review build — author and repository identifiers are masked. Submitted to "
              : "Submitted to "}
            {SITE.venue}.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">
            Research preview · maintained by the authors.
          </p>
        )}
      </div>
    </footer>
  );
}
