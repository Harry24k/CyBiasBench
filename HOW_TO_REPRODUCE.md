# How to reproduce CyBiasBench

This guide walks readers through the two reproduction tiers we ship.
Pick the one that matches what you want to verify; you do not need to
run both.

| Tier | What it proves | Needs | Time | Cost |
|---|---|---|---|---|
| **R1 — re-analysis** | Released traces re-derive the released aggregate records, byte-for-byte under the documented CSRF policy; paper Section 4 / Appendix B JSD numbers reproduce. | Python ≥ 3.10 | ~1 minute | $0 |
| **R3 — re-experiment** | The published harness, given API keys, produces a session whose downstream artefacts share schema and pipeline with the released data. | Docker, ~10 GB disk, agent API keys | ~10 min for one session; weeks for the full 630-session matrix | tens of cents per single session; thousands of USD for the full matrix |

R1 is enough for readers who only need to verify dataset integrity and
paper-number reproducibility. R3 is for readers who want to validate
the data-collection methodology end to end.

---

## R1 — Re-analysis from released traces

R1 needs nothing beyond the released parquet/CSV files and a Python
environment.

```bash
git clone https://github.com/Harry24k/CyBiasBench.git
cd CyBiasBench
pip install -e '.[jsd]'    # pandas, pyarrow, matplotlib, scipy, numpy
```

Start with the consistency and JSD checks:

```bash
# 1. Internal-consistency suite (rows, domains, cross-table sums)
python scripts/verify_consistency.py

# 2. Round-trip closure: re-derive `attack_total` and `attack_success`
#    counts directly from the released traces with the documented
#    CSRF success-exclusion policy applied. Must match the released
#    records exactly (0 mismatches in 180 + 450 sessions).
python scripts/verify_consistency.py --round-trip

# 3. Reproduce the paper's Prompt-stability JSD numbers.
#    Expected output:
#      within-agent mean JSD = 0.0379  (paper §4)
#      between-agent mean    = 0.0543  (paper §4)
#      per-condition mean    = 0.0258  (paper Appendix B)
#      per-condition max     = 0.0433  (paper Appendix B)
python scripts/jsd_repro/table2_jsd_robustness.py
python scripts/jsd_repro/prompt_profile_stability.py
```

That's it. If `verify_consistency.py --round-trip` ends with
`ALL CHECKS PASSED`, dataset integrity is confirmed. If the JSD scripts
print the four expected numbers, paper-number reproducibility is
confirmed.

The figures emitted to `scripts/jsd_repro/figures/` reproduce the JSD analysis.
Rendering details can differ across Matplotlib and font versions.

### Reviewer-requested uncertainty and counting-unit checks

```bash
python scripts/reviewer_revisions.py --output-dir analysis/reviewer_revisions
```

This checks attack and success counts against traces for all 630 sessions, then
generates a JSON result with input SHA-256 hashes, LaTeX table rows, and the ASR
confidence-interval figure. Injection `session_asr` values are rounded to four
decimals in the records; inference uses the exact count ratios. Zero-attack
sessions contribute ASR zero. The original CSRF success-exclusion policy is
preserved.

- **ASR:** 20,000 percentile bootstrap draws, seed 20260725, complete sessions
  resampled within agent × scenario. The five fixed agents have equal weight.
  Expected aggregate ΔASR: −0.0582, 95% CI [−0.0919, −0.0247]. Three individual
  intervals include zero. These are original-verifier results, not the human
  audit's corrected ASR figures.
- **Counting units:** raw requests, identical-probe bursts, family episodes,
  unique probes, and family presence. Probes use family, method, normalized
  path, and sorted matched-rule identifiers. Normalization drops query strings
  and maps decimal path segments to `{id}`. Consecutiveness is over focal-family
  requests. The 179 nonempty sessions enter compositional tests; all 180 enter
  breadth averages.
- **Inference:** 1,999 permutations, seed 20261017, preserving complete session
  vectors and agent sample sizes within target × prompt-condition blocks. All
  five session-macro tests reach the plus-one reporting floor of 0.0005.

The explicit public-trace probe definition gives slightly different burst and
unique-probe JSDs from the less fully specified rebuttal table. The camera-ready
working copy uses the regenerated values: burst 0.052/0.080 and unique probe
0.048/0.070 (pooled/session-macro). This is a counting-definition clarification,
not a new data collection or a change to the original family labels.


### Bias momentum

```bash
python scripts/momentum_repro.py --output-dir analysis/momentum
```

This exports the 50 agent–family cells and their correlations. Observation
selection and per-family ASR use pooled family counts reconstructed from the
released selection rates and ASR values. Compliance is the mean over nine
injection sessions per cell. Unattempted-family ASR is zero, matching the figure.

The reported estimator standardizes each variable within each agent using the
population standard deviation, then computes Spearman correlation over the
50 cells: **ρ = +0.529341** for selection versus compliance and
**ρ = −0.247875** for per-family ASR versus compliance. The JSON also reports raw
pooled correlations and mean per-agent correlations as distinct estimators.
P-values in the output are unadjusted; the paper applies Bonferroni correction
when interpreting the reported correlations.

### Agent identification and temporal adaptation

```bash
pip install -e '.[analysis]'  # adds scikit-learn to the re-analysis dependencies
python scripts/agent_identification.py --output-dir analysis/agent_identification
python scripts/temporal_repro.py --output-dir analysis/temporal
```

Agent identification uses the ten-family selection vector from each of the
180 observation sessions, including an all-zero vector for the empty session.
A random forest with 500 trees and seed 42 yields leave-one-out accuracy 0.650
and macro F1 0.649154, and stratified five-fold accuracy 0.650 and macro F1
0.650718. These values were checked with scikit-learn 1.8.0. The output records
the library version, predictions, confusion matrix, and input hashes. This
analysis uses one worker and can take a few minutes.

Temporal analysis sorts classified non-`others` requests by `request_index`,
using the released trace success flags and paths without query strings. It
computes transition rates and repeated-failure shares per session, then averages
defined values by agent. The displayed failure/success switch ratio is the
quotient of the two macro-average transition rates. This reproduces all columns
of the dashboard's temporal table. These trace-success diagnostics preserve CSRF
flags as released; they are distinct from session ASR, whose numerator excludes
CSRF successes. Neither analysis uses expert-corrected labels.

### Dashboard release statistics

Run from the repository root after `pip install -e '.[analysis]'`:

```bash
python dashboard/scripts/build_site_summary.py
# Optional full recomputation and comparison (does not write):
python dashboard/scripts/build_site_summary.py --check
# Fast tests of aggregation and missing-family behavior:
python -m unittest discover -s dashboard/scripts/tests -v
```

This is a complete reconstruction of `dashboard/public/data/paper_summary.json`.
It needs only the public observation records, observation family-long table,
injection records, and both trace CSVs. Neither an existing summary, intermediate
`analysis/` outputs, nor the private paper tree is required. `--data-dir PATH`
and `--summary PATH` override the input and output locations. Random-forest
leave-one-out evaluation takes a few minutes; it uses one worker. No model calls
or network access are needed. `--check` compares every field with absolute and
relative numeric tolerances of `1e-12` and reports changed field paths.

Aggregation conventions preserved from the paper and dashboard:

- Selection and diversity use the focal ten families. Observation family counts
  are reconstructed as `attack_total * selection_rate_pct / 100`, without integer
  rounding. Heatmaps pool those counts within each agent or agent/condition.
  Entropy, distinct-family count, and Selection CR1 are computed per session and
  then averaged, including empty sessions as zeros. These are distinct from the
  archived session-mean heatmap aggregation discussed in the paper.
- Entropy–ASR Spearman correlations and Kruskal–Wallis tests use those session
  metrics. Kruskal effect size is `(H - k + 1) / (n - k)`.
- Prompt-axis JSD contrasts pooled Guided/Unguided and Structured/Unstructured
  profiles. Centroid statistics compare normalized condition profiles to their
  count-weighted agent centroid, using the archived `1e-12` smoothing; the
  between-agent centroid statistics use the same smoothing. Target-wise
  marginal JSD uses unsmoothed pooled counts. Headline JSD values are calculated
  and then rounded to the paper's four decimal places.
- Compliance–selection and compliance–family-ASR correlations standardize
  within agent before pooling. Family-ASR transfer uses raw pooling over all
  50 cells with undefined family ASR set to zero; scatter data retains `null`
  for those undefined values. Compliance–session-ASR uses raw pooled cells and
  means of the released (four-decimal) injection session-ASR column.
- Tokens per success is total tokens divided by total successful requests,
  including tokens spent in unsuccessful sessions. It is not the mean of
  per-session ratios. The decoupling table uses each agent's most-selected
  family, that family's pooled ASR, and the agent's token cost.
- The ASR comparison and bootstrap use exact trace-verified count ratios,
  unlike the rounded column used by the historical cell correlation above.
  Temporal diagnostics and RF identification follow the definitions immediately
  above this section. All success labels remain the original automatic labels.

The `reproduction` block records the five input hashes and method metadata.
The builder checks that the inputs did not change during computation. Full
reconstruction was verified with Python 3.12.6, NumPy 2.2.4, pandas 2.2.3, SciPy
1.16.3, and scikit-learn 1.8.0. Random-forest results can depend on the library
version, so use scikit-learn 1.8.0 when reproducing the checked-in snapshot.

---

## R3 — Re-experiment from scratch

R3 re-runs the published harness in `benchmark/` to produce a fresh
session, then feeds it through the same analysis pipeline R1 uses.

### Setup

```bash
cd benchmark/
cp .env.example .env
# fill at least one of:
#   ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY,
#   KIMI_API_KEY, GLM_API_KEY (+ GLM_BASE_URL)
```

The agent CLI versions used to collect the released data are pinned in
the agent Dockerfiles via `ARG`s — see the table in `benchmark/README.md`.
First-run image build takes 5–10 minutes; subsequent runs reuse the
cached images.

### Run a single session

```bash
# bias_observation, guided × unstructured, claude × juice-shop
./run.sh --prompt prompts/guided.txt --claude --mode report --victim juice-shop

# bias_observation, unguided × structured — output-format must be passed
# explicitly because the entrypoint default only covers the guided × *
# combinations. The released unguided sessions used the same flag.
./run.sh --prompt prompts/unguided.txt --gemini --mode struct --victim juice-shop \
    --output-format output_formats/unguided_structured.txt

# bias_injection, codex tasked with SQL injection on vuln-shop
./run.sh --prompt prompts/scen2_sqli.txt --codex --mode struct --victim vuln-shop
```

Each invocation creates `results/{session_id}/` containing the same
`output/`, `api-logs/`, `http-logs/`, `analysis/` tree the released data
was built from. `run.sh` automatically calls the analysis pipeline on
the new session, so when it returns you already have:

- `analysis/{agent}_attack_labeled.jsonl` — per-request attack family + success
- `analysis/vulnerability_results.json` — per-agent ASR, per-family counts
- `analysis/summary.json` — token + cost totals (TPS denominator)

### From a session to release-shape records

```bash
cd ..    # back to repo root

# Aggregate every session in benchmark/results/ into one wide JSON record.
python scripts/aggregate/bias_observation.py \
    --results-dir benchmark/results --output /tmp/obs_stats.json --force
python scripts/aggregate/bias_injection.py \
    --results-dir benchmark/results --output /tmp/inj_stats.json --force

# Build the released wide + long parquet/CSV tables from those JSONs.
mkdir -p /tmp/r3_out
cp /tmp/obs_stats.json /tmp/r3_out/bias_observation_stats.json
cp /tmp/inj_stats.json /tmp/r3_out/bias_injection_stats.json
python scripts/build_records.py --src /tmp/r3_out --out /tmp/r3_out
```

The resulting `/tmp/r3_out/bias_observation_records.parquet` has the
same 11 columns and dtypes as `data/bias_observation_records.parquet`,
so a fresh session can be `pd.concat`'d onto the released matrix
without any schema bridging.

### Re-running the full matrix

The released matrix is 5 agents × 3 targets × (4 conditions × 3 reps +
10 families × 3 reps) = 630 sessions. Reproducing it in full takes
weeks of wall-clock time and several thousand USD of API spend; it is
not expected of readers and we do not provide a one-button script
for it. The single-session example above is sufficient to verify that
the harness is real and the schema lines up.

If you do attempt a partial sweep, parallel `./run.sh` invocations from
separate shells are safe — each gets an isolated Docker network with
its own per-session metrics-proxy port.

---

## Common requirements

- Python ≥ 3.10 (R1 + the analysis steps of R3)
- Docker + docker compose (R3 only)
- Internet access for: the agent API providers (R3), Docker Hub for
  juice-shop / webgoat (R3), npm + PyPI for agent CLI installs (R3
  first build only)
- ~10 GB disk for built agent + victim images (R3)

R1 has no Docker or API dependency.

## Layout reference

```
CyBiasBench/
├── data/                   # released CSV + Parquet (the dataset itself)
├── schema/                 # column-level docs for every released table
├── scripts/                # R1 re-analysis + R3 post-processing
│   ├── classify/           # OWASP CRS + victim-specific classifiers
│   ├── verify/             # response heuristics + session ASR verifier
│   ├── aggregate/          # bias_{observation,injection}.py
│   ├── jsd_repro/          # paper Section 4 / Appendix B numbers
│   ├── reviewer_revisions.py # bootstrap CIs + request-unit checks
│   ├── momentum_repro.py     # standardized compliance correlations
│   ├── agent_identification.py # random-forest cross-validation
│   ├── temporal_repro.py     # sequential response to failure
│   ├── build_records.py
│   ├── build_traces.py
│   └── verify_consistency.py
├── benchmark/              # R3 re-experiment harness
│   ├── run.sh
│   ├── agents/             # 6 agent Docker setups (versions pinned)
│   ├── metrics/            # LiteLLM proxy + mitmproxy logger
│   ├── prompts/            # 13 prompt files (4 observation + 10 injection - 1 example)
│   ├── output_formats/     # 4 condition templates
│   └── victims/            # 4 locally-built target images
├── src/cybiasbench/        # tiny Python loader package
└── croissant.json          # NeurIPS 2026 metadata
```

## Troubleshooting

- `verify_consistency.py --round-trip` fails after a fresh clone — the
  released `data/` files are out of sync with the scripts. Open an issue
  before debugging further; do not regenerate `data/` from the harness
  for an R1 check.
- R3 `./run.sh` hangs at "Waiting for victim..." — check the victim
  container's own logs (`docker logs victim-{session_id}`); usually the
  in-image web server is taking longer than 60 s to bind its port. The
  bentoml and gradio victims are heaviest.
- "Metrics proxy not reachable" — the LiteLLM proxy crashed because the
  configured `*_API_KEY` is missing or rejected. Check `.env` and
  `api-logs/proxy.log`.
- The agent ran but `analysis/` is empty — this points at one of the
  classifier / verifier scripts not being found. They live at
  `../scripts/classify/classify_attacks.py` and
  `../scripts/verify/verify_success.py` relative to `benchmark/`; run.sh
  references them via that exact path.
