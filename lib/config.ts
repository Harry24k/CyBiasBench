/**
 * Site-wide configuration. Single source for author/repo/paper metadata so
 * anonymization can be toggled with one env variable.
 */

export const IS_ANONYMOUS =
  process.env.NEXT_PUBLIC_ANONYMOUS === "true" ||
  process.env.NEXT_PUBLIC_ANONYMOUS === "1";

export const SITE = {
  name: "CyBiasBench",
  fullTitle:
    "CyBiasBench: Benchmarking Bias in LLM Agents for Web Exploitation Scenarios",
  shortDescription:
    "A 630-session benchmark for measuring attack-selection bias in LLM cyber-attack agents.",
  longDescription:
    "CyBiasBench is a benchmark for quantifying attack-selection bias — the model-specific tendency of an LLM agent to concentrate effort on a narrow set of attack families regardless of prompt variation. It evaluates 5 agents across 3 vulnerable web targets in 4 prompt conditions (180 Bias Observation sessions), plus 450 Bias Injection sessions, defining bias and performance jointly over agent HTTP traffic.",
  year: 2026,
  venue: "NeurIPS 2026 Datasets & Benchmarks (Evaluation track)",
  license: "CC-BY-4.0",
  // Final URL to be set when site is deployed.
  url: "https://harry24k.github.io/CyBiasBench/",
};

interface Researcher {
  name: string;
  affiliation: string;
  corresponding?: boolean;
}

const REAL_RESEARCHERS: Researcher[] = [
  { name: "Taein Lim", affiliation: "Chung-Ang University" },
  { name: "Seongyong Ju", affiliation: "Chung-Ang University" },
  { name: "Munhyeok Kim", affiliation: "Chung-Ang University" },
  { name: "Hyunjun Kim", affiliation: "Myongji University", corresponding: true },
  { name: "Hoki Kim", affiliation: "Chung-Ang University", corresponding: true },
];

const ANONYMOUS_RESEARCHERS: Researcher[] = [
  { name: "Anonymous Author 1", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 2", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 3", affiliation: "Anonymous Institution" },
  { name: "Anonymous Author 4", affiliation: "Anonymous Institution", corresponding: true },
  { name: "Anonymous Author 5", affiliation: "Anonymous Institution", corresponding: true },
];

export const RESEARCHERS: Researcher[] = IS_ANONYMOUS
  ? ANONYMOUS_RESEARCHERS
  : REAL_RESEARCHERS;

export const REPO = {
  // GitHub URL for the canonical dataset documentation + reproduction code.
  url: IS_ANONYMOUS ? null : "https://github.com/Harry24k/CyBiasBench",
  label: IS_ANONYMOUS ? "Anonymized" : "GitHub",
};

export const PAPER = {
  // Path served from the static site root.
  pdfPath: IS_ANONYMOUS ? null : "/paper/full_paper.pdf",
  label: IS_ANONYMOUS ? "PDF (under review)" : "Paper PDF",
};
