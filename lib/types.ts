export interface PerExperiment {
  session_id: string;
  agent: string;
  target: string;
  guidance: string;
  structure: string;
  condition: string;
  total_requests: number;
  attack_requests: number;
  benign_requests: number;
  attack_ratio: number;
  technique_distribution: Record<string, number>;
  shannon_entropy: number;
  hhi: number;
  overall_asr: number;
  successful_attacks: number;
  per_technique_asr: Record<string, { attempted: number; succeeded: number; asr: number }>;
  agent_cost_usd: number;
  agent_tokens: number;
  cost_per_success: number | null;
  tokens_per_attack: number | null;
  tokens_per_success: number | null;
  first_move: string | null;
  attack_sequence_length: number;
  unique_techniques: number;
  persistence_max_consecutive: number;
  persistence_avg_consecutive: number;
  persistence_score: number;
  exploration_rate: number;
  exploration_coverage: number | null;
  total_possible_techniques: number | null;
  self_report_concordance: {
    actual_attack_count: number;
    self_reported_count: number;
    concordance_rate: number;
    overclaim: number;
    underclaim: number;
  } | null;
  preference_index: Record<string, number>;
  inertia_rate: number | null;
  per_technique_depth: Record<string, number>;
  method_bias: {
    get_pct: number;
    post_pct: number;
    put_pct: number;
    delete_pct: number;
    head_pct: number;
    other_pct: number;
    attack_post_pct: number;
  };
  hallucinated_attack_bias: number | null;
  mismatch: number;
  payload_diversity: Record<
    string,
    { unique_payloads: number; total: number; diversity_ratio: number }
  >;
  recon_ratio: number;
  unique_endpoints: number;
  top_technique: {
    technique: string;
    count: number;
    share_pct: number;
  } | null;
  avg_latency: {
    all_requests_ms: number | null;
    attack_only_ms: number | null;
  };
  solved_challenges: number | null;
  total_challenges: number | null;
  challenge_asr: number | null;
  challenge_details: {
    key: string;
    name: string;
    category: string;
    difficulty: number;
    solved: boolean;
  }[] | null;
  tokens_per_challenge: number | null;
}

export interface AggregatedAgent {
  total_requests: number;
  total_attack_requests: number;
  total_successful_attacks: number;
  overall_attack_ratio: number;
  overall_asr: number;
  total_cost_usd: number;
  total_tokens: number;
  cost_per_success: number | null;
  tokens_per_attack: number | null;
  tokens_per_success: number | null;
  technique_distribution: Record<string, number>;
  shannon_entropy: number;
  hhi: number;
  per_technique_asr: Record<string, { attempted: number; succeeded: number; asr: number }>;
  first_move_distribution: Record<string, number>;
  avg_persistence_score: number;
  avg_exploration_rate: number;
  avg_exploration_coverage: number | null;
  experiment_count: number;
  avg_inertia_rate: number | null;
  avg_hallucinated_attack_bias: number | null;
  avg_mismatch: number | null;
  total_unique_endpoints: number;
  avg_recon_ratio: number;
  method_bias: {
    get_pct: number;
    post_pct: number;
    put_pct: number;
    delete_pct: number;
    head_pct: number;
    other_pct: number;
    attack_post_pct: number;
  };
  top_technique: {
    technique: string;
    count: number;
    share_pct: number;
  } | null;
  avg_latency: {
    all_requests_ms: number | null;
    attack_only_ms: number | null;
  };
  total_solved_challenges: number | null;
  total_challenges: number | null;
  avg_challenge_asr: number | null;
  tokens_per_challenge: number | null;
  bias_asr_correlation: BiasAsrCorrelation | null;
}

export interface JsdAnalysis {
  techniques: string[];
  jsd: Record<string, number>;
  vectors: Record<string, number[]>;
}

export interface ChiSquared {
  chi2: number;
  p_value: number;
  dof: number;
  significant_005: boolean;
  agents: string[];
  techniques: string[];
}

export interface FisherTest {
  odds_ratio: number | null;
  p_value: number;
  significant_005: boolean;
  table: number[][];
}

export interface SpearmanResult {
  rho: number;
  p_value: number;
  significant_005: boolean;
}

export interface CrossTargetShiftEntry {
  jsd: number;
  target1: string;
  target2: string;
  target1_asr: number;
  target2_asr: number;
  target1_ar: number;
  target2_ar: number;
  target1_entropy: number;
  target2_entropy: number;
  techniques: string[];
  target1_vector: number[];
  target2_vector: number[];
}

export interface BiasAsrTechnique {
  total_attempts: number;
  total_successes: number;
  asr: number;
  attempt_share: number;
  per_agent_attempts: Record<string, number>;
}

export interface BiasAsrCorrelation {
  per_technique: Record<string, BiasAsrTechnique>;
  weighted_mean_asr: number;
  attempt_weighted_asr: number;
}

export interface GuidedConditionStats {
  experiment_count: number;
  attack_requests: number;
  successful: number;
  asr: number;
  technique_distribution: Record<string, number>;
  entropy: number;
  avg_exploration_rate: number;
  avg_persistence_score: number;
}

export interface GuidedVsUnguidedAgent {
  guided: GuidedConditionStats;
  unguided: GuidedConditionStats;
  delta_asr: number;
  delta_entropy: number;
  technique_shift_jsd: number;
}

export interface GuidedVsUnguidedSummary {
  guided_mean_asr: number;
  unguided_mean_asr: number;
  overall_delta_asr: number;
}

export interface GuidedVsUnguided {
  by_agent: Record<string, GuidedVsUnguidedAgent>;
  summary: GuidedVsUnguidedSummary;
}

export interface StructuredConditionStats {
  experiment_count: number;
  attack_requests: number;
  successful: number;
  asr: number;
  technique_distribution: Record<string, number>;
  entropy: number;
  avg_exploration_rate: number;
  avg_persistence_score: number;
}

export interface StructuredVsUnstructuredAgent {
  structured: StructuredConditionStats;
  unstructured: StructuredConditionStats;
  delta_asr: number;
  delta_entropy: number;
  technique_shift_jsd: number;
}

export interface StructuredVsUnstructuredSummary {
  structured_mean_asr: number;
  unstructured_mean_asr: number;
  overall_delta_asr: number;
}

export interface StructuredVsUnstructured {
  by_agent: Record<string, StructuredVsUnstructuredAgent>;
  summary: StructuredVsUnstructuredSummary;
}

export interface AnalysisResults {
  per_experiment: PerExperiment[];
  aggregated_by_agent: Record<string, AggregatedAgent>;
  aggregated_by_target: Record<string, Record<string, AggregatedAgent>>;
  aggregated_by_condition: Record<string, Record<string, AggregatedAgent>>;
  statistical_tests: {
    jsd_analysis: JsdAnalysis;
    chi_squared: ChiSquared;
    fisher_tests: Record<string, Record<string, FisherTest>>;
    spearman_correlation: Record<string, SpearmanResult>;
  };
  cross_target_shift: Record<string, Record<string, CrossTargetShiftEntry>>;
  bias_asr_correlation: BiasAsrCorrelation;
  guided_vs_unguided: GuidedVsUnguided;
  structured_vs_unstructured?: StructuredVsUnstructured;
  model_colors: Record<string, string>;
  experiment_matrix: Record<string, { target: string; guidance: string; structure: string }>;
}

export const AGENTS = ["claude", "codex", "gemini"] as const;
export type Agent = (typeof AGENTS)[number];

export const MODEL_COLORS: Record<string, string> = {
  claude: "#E8956A",   // Anthropic coral
  codex: "#10A37F",    // OpenAI green
  gemini: "#4285F4",   // Google blue
};

export const AGENT_LABELS: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
};

export const AGENT_MODELS: Record<string, string> = {
  claude: "Claude Opus 4.5",
  codex: "GPT-5.2 Codex",
  gemini: "Gemini 2.5 Pro",
};

import { BASE_PATH } from "@/lib/utils";

export const AGENT_ICONS: Record<string, string> = {
  claude: `${BASE_PATH}/icons/claude.svg`,
  codex: `${BASE_PATH}/icons/codex.svg`,
  gemini: `${BASE_PATH}/icons/gemini.svg`,
};

export const TARGET_LABELS: Record<string, string> = {
  "juice-shop": "Juice Shop",
  "mlflow": "MLflow",
  "vuln-shop": "Vuln Shop",
};
