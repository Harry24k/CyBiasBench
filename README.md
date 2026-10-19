# CyBiasBench

A benchmark for **behavioral bias in LLM offensive-security agents**.
Each record summarizes one agent's session against one intentionally
vulnerable target application, capturing not just whether attacks succeeded
but *how the agent chose, sequenced, and stuck with attack families*.

> **Status:** public release accompanying the NeurIPS 2026 Evaluations &
> Datasets Track paper. Paper: <https://arxiv.org/abs/2605.07830>.
> Interactive result dashboard: <https://trustworthyai.co.kr/CyBiasBench/>.

## What's in the box

- **5 agents** — `claude`, `codex`, `gemini`, `kimi`, `glm`
- **3 vulnerable target apps** — `juice-shop`, `mlflow`, `vuln-shop`
- **Two settings**:
  - **Bias observation** (free-choice): 4 prompt conditions × 3 reps = 180
    sessions. Conditions cross prompt guidance (`guided` / `unguided`)
    with output structure (`structured` / `unstructured`).
  - **Bias injection** (requested-family): 10 attack families × 3 reps =
    450 sessions. Each session is asked to focus on one specific family
    (SQLi, CMDi, SSRF, IDOR, …).
- **11 columns per row** in the bias observation setting (counts, session
  ASR, entropy, most-selected family, Selection CR1, total tokens).
  13 columns per row in the bias injection setting (compliance,
  requested-family ASR, same counts).
- **Long-form companion tables** with per-(session, attack family) breakdowns.
- **Sanitized request-level traces** (paper Table 5 schema): 19,116 rows
  (observation) + 258,019 rows (injection) of HTTP requests with attack
  family labels, classifier rule identifiers, CAPEC / CWE mappings, and
  success flags plus per-session request order. Bodies, headers, absolute
  timestamps, and fine-grained timing are stripped.

The paper analyzes **10 attack families** (sqli, xss, cmdi, path_traversal,
auth_bypass, idor, ssrf, csrf, file_upload, info_disclosure) chosen via
CAPEC + CWE + OWASP WSTG analysis as the families most directly testable
against the three target applications. The trace-level classifier inherits
an eleventh label (`deserialization`) from OWASP CRS rule family 944; it
is never a requested target and accounts for &lt;0.1% of trace rows. See
`schema/glossary.md` §"Attack-family scope" for full details.

Total release: **630 aggregated records + 277,135 trace rows ≈ 48 MB**.

## Interpretation and limits

These measurements describe five deployed-agent snapshots on three web targets,
not stable model rankings. Allocation reflects the model, system prompt, CLI,
tools, and target interaction. Vulnerability availability, discoverability,
execution difficulty, and request costs also affect family shares; the design
does not identify intrinsic preference or separate these factors causally.

Session-bootstrap analysis under the original automatic labels finds no
improvement in aggregate mean session ASR under steering. It does not establish
a reliable decrease for every agent. Alternative request-counting units preserve
between-agent separation, while changing its magnitude. Decision value at larger
scale, superiority to simple diversity heuristics, and generalization to unseen
targets remain open. See `HOW_TO_REPRODUCE.md` for the reproducible analyses.

## Quick start

```bash
git clone https://github.com/Harry24k/CyBiasBench.git
cd CyBiasBench
pip install -e .          # loader: pandas + pyarrow
pip install -e '.[jsd]'   # add matplotlib + scipy + numpy for re-analysis

python -c "
from cybiasbench import load_bias_observation, load_bias_injection
obs = load_bias_observation()
inj = load_bias_injection()
print(obs.wide.shape, inj.wide.shape)               # (180, 11) (450, 13)
print(obs.wide.groupby('agent').session_asr.mean()) # mean session ASR per agent
"
```

Or load CSV / Parquet directly:

```python
import pandas as pd
obs = pd.read_parquet("data/bias_observation_records.parquet")
```

> **Reproduction:** see [`HOW_TO_REPRODUCE.md`](HOW_TO_REPRODUCE.md) for the
> two-tier reproduction guide (R1 re-analysis from the released traces;
> R3 full re-experiment via `benchmark/`).

## Layout

```
CyBiasBench/
├── data/                                 # tabular release (CSV + Parquet)
│   ├── bias_observation_records.{csv,parquet}        180 rows
│   ├── bias_observation_family_long.{csv,parquet}    1,082 rows
│   ├── bias_observation_traces.{csv,parquet}         19,116 rows (request-level)
│   ├── bias_injection_records.{csv,parquet}          450 rows
│   ├── bias_injection_family_long.{csv,parquet}      1,597 rows
│   └── bias_injection_traces.{csv,parquet}           258,019 rows (request-level)
├── schema/
│   ├── glossary.md                       metric definitions
│   ├── columns_bias_observation.md
│   ├── columns_bias_injection.md
│   └── columns_traces.md
├── src/cybiasbench/                      python loader package
├── scripts/                              R1 re-analysis + R3 post-processing
│   ├── build_records.py                  final_stats JSON → aggregate CSV/Parquet
│   ├── build_traces.py                   labeled JSONL → request-level CSV/Parquet
│   ├── verify_consistency.py             sanity suite (+ --round-trip closure)
│   ├── reviewer_revisions.py             bootstrap CIs + request-unit robustness
│   ├── momentum_repro.py                 compliance correlations + estimator comparison
│   ├── agent_identification.py           random-forest agent identification
│   ├── temporal_repro.py                 response to failure in request order
│   ├── classify/                         OWASP CRS + victim-specific classifiers
│   ├── verify/                           response heuristics + session verifier
│   ├── aggregate/                        final_stats.json generator
│   └── jsd_repro/                        Prompt-stability JSD reproduction
│       ├── table2_jsd_robustness.py      paper Table 2 (within/between-agent JSD)
│       └── prompt_profile_stability.py   paper appendix per-condition JSD
├── benchmark/                            R3 re-experiment harness (Docker + agents)
│   ├── run.sh                            one invocation = one (agent, target, prompt) session
│   ├── agents/                           6 agent CLI Dockerfiles (CLI versions pinned)
│   ├── metrics/                          LiteLLM proxy + mitmproxy HTTP logger
│   ├── prompts/                          guided/unguided + 10 injection prompts
│   ├── output_formats/                   4 condition templates
│   └── victims/                          locally-built target images
├── HOW_TO_REPRODUCE.md                   R1 + R3 reproduction walkthrough
├── DATASHEET.md                          Gebru et al. datasheet
├── RESPONSIBLE_USE.md                    dual-use guidance
├── croissant.json                        Croissant metadata (core + RAI)
├── LICENSE                               CC BY-NC-ND 4.0 (data / docs)
├── LICENSE-CODE                          MIT (code)
└── dashboard/                            Next.js source of the interactive result dashboard
```

## Settings (matches paper terminology)

The two settings here match Sections 4 and 5 of the accompanying paper:

| Setting | Paper section | Records | Design |
|---|---|---|---|
| Bias observation | §4 ("free-choice setting") | 180 | 5 agents × 3 targets × 4 conditions × 3 reps |
| Bias injection | §5 | 450 | 5 agents × 3 targets × 10 requested families × 3 reps |

Column names align with the paper's session-summary schema (Table 4):
`agent`, `target`, `condition`, `entropy`, `attack_total`, `session_asr`,
`compliance`, `requested_family`, etc. See `schema/glossary.md` for the full
mapping.

## Metric layers

Three layers from paper Table 1:

- **Bias** — `entropy` ($H(X)$), `selection_rate_pct` ($\mathrm{Sel}_i$ in long form),
  `most_selected_family`, `selection_cr1`.
- **Performance** — `session_asr` (session ASR), `asr` ($\mathrm{ASR}_i$ per family in long form).
- **Efficiency & Robustness** — `total_tokens` (paper's TPS = `total_tokens / attack_success`).
  Prompt-stability JSD is reproduced from the released long-form selection table by
  `scripts/jsd_repro/` (paper Section 4 within/between-agent and Appendix B per-condition).

## Reproducing the records

The released CSV / Parquet files are produced by `scripts/build_records.py`
(aggregate tables) and `scripts/build_traces.py` (request-level traces)
from upstream JSON / JSONL artifacts emitted by the experiment harness.
The upstream artifacts are bundled in the supplementary archive
accompanying the paper.

```bash
python scripts/build_records.py            # rebuild data/*records and *family_long
python scripts/build_traces.py             # rebuild data/*traces
python scripts/verify_consistency.py       # rows, domains, cross-table sums

# Strongest internal-consistency proof — re-derive records counts from the
# released traces (CSRF success-exclusion policy applied) and require an
# exact match. Closes the loop traces → policy → records:
python scripts/verify_consistency.py --round-trip

# Reproduce the paper's Prompt-stability JSD numbers from the released artefacts:
python scripts/jsd_repro/table2_jsd_robustness.py     # within/between-agent JSD
python scripts/jsd_repro/prompt_profile_stability.py  # per-condition JSD vs centroid
```

The classifier, verifier, and aggregator that turn raw HTTP captures into
the released artefacts live under `scripts/classify/`, `scripts/verify/`,
and `scripts/aggregate/`. Each has its own README documenting policy
decisions (most importantly the CSRF success-exclusion policy referenced
from `schema/columns_traces.md`).

## What is *not* in this release

Request and response bodies, response headers, and verbatim agent reasoning
transcripts are withheld. Released sanitized traces retain only the request
path (control characters stripped), method, response status code, and the
classifier outputs (attack_family, matched_rules, CAPEC, CWE, success flag, short
non-payload evidence label). See `RESPONSIBLE_USE.md` for the full
sanitization protocol.

## Interactive dashboard

The interactive result dashboard at <https://trustworthyai.co.kr/CyBiasBench/>
is built from `dashboard/` (Next.js, static export) and deployed by
`.github/workflows/deploy.yml` on every push that touches that directory.
It is independent of the data release above: `data/`, `scripts/`, and
`croissant.json` do not depend on anything under `dashboard/`.

```bash
cd dashboard
npm ci
npm run dev            # local preview at http://localhost:3000
```

## Licenses

| Artifact | License |
|---|---|
| `data/`, `schema/`, `*.md` | **CC BY-NC-ND 4.0** |
| `src/`, `scripts/` | **MIT** |

The data and documentation are released for non-commercial research use;
redistributing modified versions is not permitted under the dataset license.
The accompanying analysis code is MIT-licensed.

## Citation

If you use CyBiasBench, please cite:

```bibtex
@inproceedings{lim2026cybiasbench,
  title     = {CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios},
  author    = {Lim, Taein and Ju, Seongyong and Kim, Munhyeok and Kim, Hyunjun and Kim, Hoki},
  booktitle = {NeurIPS 2026 Evaluations and Datasets Track},
  year      = {2026},
  url       = {https://arxiv.org/abs/2605.07830}
}
```

## Contact

Questions and bug reports: [GitHub Issues](https://github.com/Harry24k/CyBiasBench/issues).
Corresponding authors: Hyunjun Kim (hjkim1@mju.ac.kr) and Hoki Kim (hokikim@cau.ac.kr).
