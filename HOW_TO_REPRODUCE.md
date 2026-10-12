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

Three commands cover everything R1 proves:

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

The figures emitted to `scripts/jsd_repro/figures/` are byte-equivalent
regenerations of the JSD figures in the paper.

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
