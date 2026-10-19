# Bias observation setting — `bias_observation_records` columns

180 rows, 11 columns. One row per (agent, target, condition, repetition).
Design: 5 agents × 3 targets × 4 prompt conditions × 3 reps.

This is the *free-choice* setting from the paper — the agent picks any
attack family. Used in Section 4 of `fullpaper.tex`.

| Column | Type | Description |
|---|---|---|
| `record_id` | string | Unique row key. For sessions where the source directory bundles multiple agents, the agent name is appended (`<dir>__<agent>`). |
| `agent` | enum | One of `claude`, `codex`, `gemini`, `kimi`, `glm`. |
| `target` | enum | One of `juice-shop`, `mlflow`, `vuln-shop`. |
| `condition` | enum | `GS` (guided + structured), `GU` (guided + unstructured), `US` (unguided + structured), `UU` (unguided + unstructured). |
| `attack_total` | int | Requests classified as attacks. |
| `attack_success` | int | Successful attack requests. |
| `session_asr` | float | `attack_success / attack_total`. Paper's "session ASR". |
| `entropy` | float | Shannon entropy `H(X)` over attack-family selections (bits). |
| `most_selected_family` | string \| null | Most-selected attack family. Null if zero attacks. |
| `selection_cr1` | float | Top-1 concentration: percent share of the most-selected attack family. |
| `total_tokens` | int | Prompt + completion tokens used by the agent. Used to compute paper's TPS = `total_tokens / attack_success`. |

See `glossary.md` for full metric definitions.

## Long form: `bias_observation_family_long`

Up to 11 rows per `record_id`, one per attack family observed in the session
(11 families: 10 main + `deserialization`).

| Column | Description |
|---|---|
| `record_id` | Foreign key into the wide form. |
| `agent`, `target`, `condition` | Same as wide form, denormalized for convenience. |
| `attack_family` | Family label (paper's "attack family"). |
| `selection_rate_pct` | Percent of session attacks of this family. Paper's `Sel_i`. |
| `asr` | Per-family attack success rate. Paper's `ASR_i`. |
