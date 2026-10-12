# scripts/aggregate/

Per-session aggregation. Reads the per-request labeled JSONL and the
per-session `vulnerability_results.json`, and writes one JSON record per
(session, agent) under the column shape that `scripts/build_records.py`
turns into the released `bias_*_records` tables.

## Position in the pipeline

```
labeled JSONL + vulnerability_results.json + session.json + summary.json
        │
        ▼
bias_observation.py    (free-choice; 4 prompt conditions × 3 reps)
bias_injection.py      (requested-family; 10 attack families × 3 reps)
        │
        ▼
data/bias_observation_stats.json
data/bias_injection_stats.json
        │
        ▼
scripts/build_records.py
        │
        ▼
data/bias_*_records.{csv,parquet} + data/bias_*_family_long.{csv,parquet}
```

## CSRF success-exclusion policy

`bias_observation.py` excludes CSRF from session-level `attack_success`
directly, with a comment block explaining why HTTP-only intercept cannot
verify CSRF success. `bias_injection.py` reads
`vulnerability_results.json`, which has already applied the same
exclusion in `scripts/verify/verify_success.py` (`aggregate_results`).

The net effect: `bias_*_records.attack_success` excludes CSRF success
entirely, while the per-request `bias_*_traces.success` flag preserves
what the victim-specific classifier originally observed. See
`schema/columns_traces.md` §"CSRF success accounting".

## Usage

```bash
# Bias observation setting
python scripts/aggregate/bias_observation.py \
    --results-dir /path/to/results \
    --output /tmp/bias_observation_stats.json --force

# Bias injection setting
python scripts/aggregate/bias_injection.py \
    --results-dir /path/to/results \
    --output /tmp/bias_injection_stats.json --force
```

When invoked without `--results-dir`, both scripts default to
`../benchmark/results/` (the per-session output of `benchmark/run.sh`).
Reviewers running R1 (re-analysis from released traces only) do not need
to invoke these scripts — the released `bias_*_records` are already the
aggregator output. `verify_consistency.py --round-trip` instead checks
that the same CSRF policy, applied directly to the released traces,
reproduces the released aggregate counts.

## Output schema (one record per session)

```json
{
  "dir": "juice-shop_scen2_csrf_03",
  "target": "juice-shop",
  "agent": "gemini",
  "requested_family": "csrf",
  "rep": "03",
  "attack_total": 12,
  "attack_success": 3,
  "session_asr": 0.25,
  "requested_family_attempts": 2,
  "requested_family_successes": 0,
  "requested_family_asr": 0.0,
  "compliance": 0.1667,
  "total_tokens": 1944031,
  "family_table": {
    "auth_bypass":     {"attempts": 4, "success": 1},
    "idor":            {"attempts": 3, "success": 0},
    "csrf":            {"attempts": 2, "success": 0}
  }
}
```

`build_records.py` consumes this JSON and emits the wide and long form
parquet / csv tables under `data/`.
