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
 * NEXT_PUBLIC_REAL_RESEARCHERS / NEXT_PUBLIC_REAL_REPO env vars override
 * the hardcoded defaults if you need to ship a different roster without a
 * code change.
 */

const DEPLOY_TARGET = process.env.NEXT_PUBLIC_DEPLOY_TARGET ?? "vercel";

/** True everywhere except the GitHub Pages build. */
export const IS_ANONYMOUS = DEPLOY_TARGET !== "github";

/** True everywhere except the GitHub Pages build. Gates NeurIPS keywords. */
export const VENUE_VISIBLE = DEPLOY_TARGET !== "github";

const REAL_SITE_URL = process.env.NEXT_PUBLIC_REAL_SITE_URL ?? "";
const REAL_REPO_URL =
  process.env.NEXT_PUBLIC_REAL_REPO ?? "https://github.com/Harry24k/CyBiasBench";
const REAL_RESEARCHERS_RAW = process.env.NEXT_PUBLIC_REAL_RESEARCHERS ?? "";

export const SITE = {
  name: "CyBiasBench",
  fullTitle:
    "CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios",
  shortDescription:
    "A 630-session benchmark for measuring attack-selection bias in LLM cyber-attack agents.",
  longDescription:
    "CyBiasBench is a benchmark for quantifying attack-selection bias — the model-specific tendency of an LLM agent to disproportionately concentrate effort on a narrow set of attack families regardless of prompt variation. It evaluates 5 agents across 3 vulnerable web targets in 4 prompt conditions (180 Bias Observation sessions), plus 450 Bias Injection sessions that test bias momentum: agents resist explicit user steering, and the forced redistribution does not yield measurable gains in attack performance.",
  year: 2026,
  /** Only render this string in components when VENUE_VISIBLE is true. */
  venue: "NeurIPS 2026 Evaluations & Datasets (E&D)",
  license: "CC-BY-4.0",
  // Anonymous build always points at the 4open.science mirror; the real
  // GitHub Pages URL is only ever read from an env var, never embedded.
  url: IS_ANONYMOUS
    ? "https://anonymous.4open.science/r/CyBiasBench-2026/"
    : REAL_SITE_URL || "https://anonymous.4open.science/r/CyBiasBench-2026/",
};

interface Researcher {
  name: string;
  affiliation: string;
  corresponding?: boolean;
}

const ANONYMOUS_RESEARCHERS: Researcher[] = [
  { name: "Anonymous Author 1", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 2", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 3", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 4", affiliation: "Anonymous Institution", corresponding: true },
];

// Default real roster — used when IS_ANONYMOUS is false and no env override
// is provided. Matches the author block in the LaTeX source.
const DEFAULT_REAL_RESEARCHERS: Researcher[] = [
  { name: "Hoki Kim", affiliation: "Chung-Ang University", corresponding: true },
  { name: "Keonwoo Kim", affiliation: "NAVER Digital Healthcare LAB" },
  { name: "Sungwon Chae", affiliation: "Seoul National University" },
  { name: "Sangwon Yoon", affiliation: "Ministry of Justice, Republic of Korea" },
];

// Real researchers can also be encoded as a JSON-serialised env var of the
// form '[{"name":"...","affiliation":"...","corresponding":true}, ...]' —
// useful for shipping a different roster without a code change.
function parseRealResearchers(): Researcher[] {
  if (!REAL_RESEARCHERS_RAW) return [];
  try {
    const parsed = JSON.parse(REAL_RESEARCHERS_RAW);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Researcher =>
        typeof x === "object" &&
        x != null &&
        typeof x.name === "string" &&
        typeof x.affiliation === "string",
    );
  } catch {
    return [];
  }
}

const envResearchers = parseRealResearchers();

export const RESEARCHERS: Researcher[] = IS_ANONYMOUS
  ? ANONYMOUS_RESEARCHERS
  : envResearchers.length > 0
    ? envResearchers
    : DEFAULT_REAL_RESEARCHERS;

export const REPO = {
  url: IS_ANONYMOUS ? null : REAL_REPO_URL || null,
  label: IS_ANONYMOUS ? "Anonymized" : "GitHub",
};

export const PAPER = {
  pdfPath: IS_ANONYMOUS ? null : "/paper/full_paper.pdf",
  label: IS_ANONYMOUS ? "PDF (under review)" : "Paper PDF",
};
