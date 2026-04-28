import { BASE_PATH } from "@/lib/utils";

export const AGENTS = ["claude", "codex", "gemini", "kimi", "glm"] as const;
export type Agent = (typeof AGENTS)[number];

export const AGENT_LABELS: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
  kimi: "Kimi",
  glm: "GLM",
};

export const AGENT_MODELS: Record<string, string> = {
  claude: "Claude Opus 4.5",
  codex: "GPT-5.2 Codex",
  gemini: "Gemini 2.5 Pro",
  kimi: "Kimi k2.5",
  glm: "GLM 5.1",
};

export const AGENT_CLIS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  kimi: "Kimi Code",
  glm: "Open Code",
};

export const MODEL_COLORS: Record<string, string> = {
  claude: "#D97757",
  codex: "#10A37F",
  gemini: "#4285F4",
  kimi: "#DC2626",
  glm: "#8B5CF6",
};

export const AGENT_ICONS: Record<string, string> = {
  claude: `${BASE_PATH}/icons/claude.svg`,
  codex: `${BASE_PATH}/icons/codex.svg`,
  gemini: `${BASE_PATH}/icons/gemini.svg`,
  kimi: `${BASE_PATH}/icons/kimi.svg`,
  glm: `${BASE_PATH}/icons/glm.svg`,
};

export const TARGET_LABELS: Record<string, string> = {
  "juice-shop": "Juice Shop",
  "mlflow": "MLflow",
  "vuln-shop": "Vuln Shop",
};

export interface AgentSignature {
  entropy: number;
  unique_techniques: number;
  top_family: string;
  top_share: number;
  session_asr_mean: number;
  session_asr_ci: [number, number];
  n_sessions: number;
}

export interface ComplianceRow {
  obs_asr: number;
  inj_asr: number;
  delta_asr: number;
  compliance_mean: number;
}

export interface EntropyAsrRho {
  rho: number;
  p: number;
  n: number;
}

export interface JsdPerAgentEntry {
  guidance: number;
  format: number;
  centroid_mean: number;
  centroid_max: number;
}

export interface JsdSummary {
  between_agent_median: number;
  between_agent_mean: number;
  within_agent_n?: number;
  between_agent_n?: number;
  axis_means?: { guidance: number; format: number };
  centroid_within_mean: number;
  per_agent?: Record<string, JsdPerAgentEntry>;
}

export interface ScatterPoint {
  agent: string;
  session_id: string;
  condition?: string;
  victim?: string;
  entropy: number;
  session_asr: number;
}

export interface CompliancePredictor {
  agent: string;
  family: string;
  sel_i: number;
  asr_i: number;
  asr_i_s2: number;
  compliance: number;
}

export interface KruskalStat { H: number; p: number; eta2: number }

export interface HeadlineStats {
  kruskal_H: KruskalStat;
  kruskal_unique_count?: KruskalStat;
  kruskal_top_share?: KruskalStat;
  kruskal_session_asr: KruskalStat;
  asr_transfer: { rho: number; p: number; n: number };
  compliance_sel: { rho: number; p: number; n: number };
  compliance_asri: { rho: number; p: number; n: number };
  all_negative_delta_asr: boolean;
}

export interface PaperSummary {
  agents: string[];
  agent_labels: Record<string, string>;
  families: string[];
  n_sessions: { s1: number; s2: number };
  table1_agent_signatures: Record<string, AgentSignature>;
  table2_jsd: JsdSummary;
  table3_entropy_asr_rho: Record<string, EntropyAsrRho>;
  table4_compliance: Record<string, ComplianceRow>;
  fig2_selection_heatmap: Record<string, Record<string, number>>;
  fig2_selection_heatmap_by_condition?: Record<string, Record<string, Record<string, number>>>;
  fig3_asr_prior: Record<string, number>;
  fig3_selection_per_agent: Record<string, Record<string, number>>;
  fig3_asri_per_agent: Record<string, Record<string, number>>;
  fig4_entropy_asr_scatter: ScatterPoint[];
  fig5_compliance_predictors: CompliancePredictor[];
  headline_stats: HeadlineStats;
  tps_per_agent?: Record<string, number | null>;
}
