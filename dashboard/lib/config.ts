/**
 * Site-wide configuration with two deploy modes:
 *
 *   ┌─────────────────────┬──────────────────┬──────────────────┐
 *   │ Deploy target       │ Author identity  │ Venue keywords   │
 *   ├─────────────────────┼──────────────────┼──────────────────┤
 *   │ Vercel (default)    │ Anonymous        │ NeurIPS visible  │
 *   │ GitHub Pages        │ Real names       │ NeurIPS hidden   │
 *   └─────────────────────┴──────────────────┴──────────────────┘
 *
 * The Vercel build serves the double-blind review URL — masks who wrote it
 * but can openly say "submitted to NeurIPS 2026". The GitHub Pages build
 * lives at a deanonymizing URL (github.com/<user>/...) so it shows the real
 * authors, but must scrub every NeurIPS keyword to avoid linking
 * <real name> + <NeurIPS submission> until the review period ends.
 *
 * Mode is controlled by a single env var at build time:
 *   • Vercel deploy   : NEXT_PUBLIC_DEPLOY_TARGET=vercel  (default)
 *   • GH Pages deploy : NEXT_PUBLIC_DEPLOY_TARGET=github  (set in workflow)
 *
 * Real author / repo data is wrapped in inline `process.env.NEXT_PUBLIC_*`
 * checks so Next.js' build-time substitution lets the bundler DCE the
 * data on the Vercel build — names never appear in the Vercel JS bundle.
 */

const DEPLOY_TARGET = process.env.NEXT_PUBLIC_DEPLOY_TARGET ?? "vercel";

/** True everywhere except the GitHub Pages build. */
export const IS_ANONYMOUS = DEPLOY_TARGET !== "github";

/** True everywhere except the GitHub Pages build. Gates NeurIPS keywords. */
export const VENUE_VISIBLE = DEPLOY_TARGET !== "github";

export const SITE = {
  name: "CyBiasBench",
  fullTitle:
    "CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
  shortDescription:
    "A 630-session benchmark for measuring attack-selection bias in LLM cyber-attack agents.",
  longDescription:
    "CyBiasBench measures operational attack selection in five deployed agent snapshots across three web targets: 180 free-choice and 450 bias-injection sessions. Steering compliance is associated with free-choice allocation, while steering does not improve aggregate mean session ASR. These patterns are conditioned by vulnerability availability, discoverability, execution difficulty, and the agent's tools and prompts.",
  year: 2026,
  /** Only render this string in components when VENUE_VISIBLE is true. */
  venue: "NeurIPS 2026 Evaluations & Datasets (E&D)",
  license: "Data: CC BY-NC-ND 4.0 · Code: MIT",
  // Anonymous build always points at the 4open.science mirror; the real
  // GitHub Pages URL is only ever read from an env var, never embedded.
  url: IS_ANONYMOUS
    ? "https://anonymous.4open.science/r/CyBiasBench-2026/"
    : "https://harry24k.github.io/CyBiasBench/",
};

interface Researcher {
  name: string;
  affiliation: string;
  /** First-author equal-contribution mark (LaTeX `\thanks{Equal contribution}`). */
  equal?: boolean;
  /** Corresponding-author mark (LaTeX `\thanks{Corresponding authors}`). */
  corresponding?: boolean;
}

const ANONYMOUS_RESEARCHERS: Researcher[] = [
  { name: "Anonymous Author 1", affiliation: "Anonymous Institution", equal: true },
  { name: "Anonymous Author 2", affiliation: "Anonymous Institution", equal: true },
  { name: "Anonymous Author 3", affiliation: "Anonymous Institution", equal: true },
  { name: "Anonymous Author 4", affiliation: "Anonymous Institution", corresponding: true },
  { name: "Anonymous Author 5", affiliation: "Anonymous Institution", corresponding: true },
];

// Real roster — kept inside an inline NEXT_PUBLIC_DEPLOY_TARGET check so the
// names are physically removed from the Vercel JS bundle by the bundler.
// Order, equal-contribution and corresponding flags follow the LaTeX source.
const REAL_RESEARCHERS: Researcher[] =
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github"
    ? [
        { name: "Taein Lim", affiliation: "Chung-Ang University", equal: true },
        { name: "Seongyong Ju", affiliation: "Chung-Ang University", equal: true },
        { name: "Munhyeok Kim", affiliation: "Chung-Ang University", equal: true },
        { name: "Hyunjun Kim", affiliation: "Myongji University", corresponding: true },
        { name: "Hoki Kim", affiliation: "Chung-Ang University", corresponding: true },
      ]
    : [];

export const RESEARCHERS: Researcher[] = IS_ANONYMOUS
  ? ANONYMOUS_RESEARCHERS
  : REAL_RESEARCHERS;

const REAL_REPO_URL =
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github"
    ? "https://github.com/Harry24k/CyBiasBench"
    : "";

export const REPO = {
  url: IS_ANONYMOUS ? null : REAL_REPO_URL || null,
  label: IS_ANONYMOUS ? "Anonymized" : "GitHub",
};

// Paper link is GH-only (arXiv preprint carries the real author block, so
// linking it from the anonymous Vercel build would deanonymize). The inline
// `process.env.NEXT_PUBLIC_DEPLOY_TARGET` check lets the bundler DCE the
// arXiv URL from the Vercel JS chunk entirely.
export const PAPER = {
  href:
    process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github"
      ? "https://arxiv.org/abs/2605.07830"
      : null,
  label:
    process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github"
      ? "Paper (arXiv)"
      : "PDF (under review)",
};
