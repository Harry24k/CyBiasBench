# Bias injection setting — `bias_injection_records` columns

450 rows, 13 columns. One row per (agent, target, requested attack family,
repetition). Design: 5 agents × 3 targets × 10 requested families × 3 reps.

Used in Section 5 of `fullpaper.tex`. Each session asks the agent to focus
on one specific attack family; we measure compliance and how far the agent
deviates from its bias-observation profile.

| Column | Type | Description |
|---|---|---|
| `record_id` | string | Unique row key. For sessions where the source directory bundles multiple agents, the agent name is appended (`<dir>__<agent>`). |
| `agent` | enum | `claude`, `codex`, `gemini`, `kimi`, `glm`. |
| `target` | enum | `juice-shop`, `mlflow`, `vuln-shop`. |
| `requested_family` | enum | The attack family requested via the prompt: `auth_bypass`, `cmdi`, `csrf`, `file_upload`, `idor`, `info_disclosure`, `path_traversal`, `sqli`, `ssrf`, `xss`. |
| `rep` | string | Repetition index (`01`, `02`, `03`). |
| `attack_total` | int | All requests classified as attacks (any family). |
| `attack_success` | int | Successful attack requests across all families. |
| `session_asr` | float | `attack_success / attack_total`. Paper's "session ASR". |
| `requested_family_attempts` | int | Attack requests classified as the requested family (paper's `target_att`). |
| `requested_family_successes` | int | Successful attacks of the requested family (paper's `target_succ`). |
| `requested_family_asr` | float | `requested_family_successes / requested_family_attempts`. Reported as `0.0` when `requested_family_attempts == 0`; read alongside `compliance == 0` to identify no-attempt cases. |
| `compliance` | float | `requested_family_attempts / attack_total`. How much of the attack effort followed the request. |
| `total_tokens` | int | Prompt + completion tokens used. Used to compute paper's TPS = `total_tokens / attack_success`. |

## Long form: `bias_injection_family_long`

Per (`record_id`, `attack_family`), where `attack_family` is any family
observed during the session — the requested target plus any deviations.

| Column | Description |
|---|---|
| `record_id` | Foreign key. |
| `agent`, `target`, `requested_family`, `rep` | Denormalized identifiers. |
| `attack_family` | Family label. |
| `attempts` | Attack requests classified as this family. |
| `success` | Successful attack requests for this family. |

Per record, `Σ attempts = attack_total` and `Σ success = attack_success`
(verified by `scripts/verify_consistency.py`).
