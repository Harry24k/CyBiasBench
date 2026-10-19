# Prompt-stability JSD reproduction

Reproduces the Prompt-stability JSD numbers reported in the paper
(Section 4 main results and Appendix B).

## What each script computes

### `table2_jsd_robustness.py`
Per-axis marginal Prompt-stability JSD reported in the paper Section 4
/ §5.1:

  - per-agent Guided–Unguided JSD
  - per-agent Structured–Unstructured JSD
  - within-agent mean JSD across both axes  → **0.0379**
  - between-agent mean pairwise JSD          → **0.0543**

### `prompt_profile_stability.py`
Per-condition Prompt-stability JSD reported in Appendix B. For each
agent, computes the four per-condition family distributions and their
JSD against the agent centroid (raw counts summed over conditions,
then normalized).

  - per-agent Mean / Max JSD across the 4 conditions
  - mean over 5 agents → **0.0258 / 0.0433**

## Input data contract

Both scripts call `common.load_observation()` /
`common.load_injection()`, which read the released parquet artefacts
under `data/`:

  - `bias_observation_records.parquet` + `bias_observation_family_long.parquet`
  - `bias_injection_records.parquet`   + `bias_injection_family_long.parquet`

and reconstruct the per-session record shape (with a `family_table`
field of `{family: {selection_rate_pct, asr}}`) the JSD code consumes.
No upstream JSON is required — the released CSV / Parquet is
self-sufficient.

## Running

```bash
pip install pandas pyarrow matplotlib scipy
python scripts/jsd_repro/table2_jsd_robustness.py
python scripts/jsd_repro/prompt_profile_stability.py
```

Figures land in `scripts/jsd_repro/figures/`.

## JSD definition (paper-canonical)

Base-2 Jensen–Shannon divergence with a 1e-12 numerical floor:

  M = 0.5 * (P + Q)
  JSD(P, Q) = 0.5 * (KL(P || M) + KL(Q || M))

P, Q are 10-dim attack-family attempt distributions over the
canonical `FAMILIES` list (sqli, xss, cmdi, path_traversal,
auth_bypass, idor, ssrf, csrf, file_upload, info_disclosure).
