# benchmark/

Full re-experiment harness. Runs one LLM offensive-security agent against
one vulnerable target inside an isolated Docker network, captures HTTP
traffic and API usage, and writes a session directory whose layout the
analysis pipeline in `../scripts/` consumes.

## Position in the project

```
benchmark/  ──→  results/{session_id}/  ──→  ../scripts/classify  ──→  ../scripts/verify  ──→  ../scripts/aggregate  ──→  ../data/
   (R3)             raw HTTP + API logs        attack family             session-level             release-shape JSON
                                                labeling                  ASR + by-family
```

This directory is the "R3" tier of reproduction: re-running the
experiments end to end. R1 (re-analysis from released traces only) and
R2 (figure regeneration) live in `../scripts/`.

## What's here

```
benchmark/
├── run.sh                          # 1 invocation = 1 (agent, target, prompt) session
├── .env.example                    # API keys
├── agents/                         # 6 agent CLI Dockerfiles
│   ├── base/                       # Kali-based common image (nmap, sqlmap, nikto, ...)
│   ├── claude/  codex/  gemini/  glm/  kimi/  opencode/
│   └── scripts/entrypoint.sh
├── metrics/
│   ├── litellm_config.yaml         # LiteLLM proxy routing
│   ├── litellm_config_opencode.yaml
│   ├── custom_logger.py            # writes usage.jsonl per API call
│   └── http_logger.py              # mitmproxy script: agent ↔ victim HTTP capture
├── prompts/                        # bias_observation: guided.txt, unguided.txt
│   └── scen2_*.txt                 # bias_injection: 10 attack-family prompts
├── output_formats/                 # 4 condition templates (guided/unguided × structured/unstructured)
├── victims/                        # locally built target images
│   ├── vuln-shop/                  # custom Express app
│   ├── mlflow/                     # vulnerable MLflow wrapper
│   ├── bentoml/                    # vulnerable BentoML wrapper
│   └── gradio/                     # vulnerable Gradio wrapper
└── scripts/aggregate_metrics.py    # usage.jsonl → analysis/summary.json (TPS denominator)
```

`juice-shop` and `webgoat` targets pull straight from Docker Hub
(`bkimminich/juice-shop`, `webgoat/webgoat`) and have no entry under
`victims/`.

> **Naming note.** The session-id substring `scen2` (paper's Scenario 2 =
> bias_injection) is preserved on purpose. Released
> `data/bias_injection_records.dir` literally contains `_scen2_`, and
> the analysis pipeline parses it. Renaming would break round-trip
> closure with the released artefacts.

## Pinned CLI versions

The agent Dockerfiles install these exact CLI versions (the same
versions used to collect the released data). Override with
`docker build --build-arg <NAME>_VERSION=<x.y.z>` when rebuilding.

| Agent | Package | Pinned via | Version |
|---|---|---|---|
| Claude | `@anthropic-ai/claude-code` | `CLAUDE_CODE_VERSION` | 2.1.50 |
| Codex  | `@openai/codex`             | `CODEX_VERSION`       | 0.104.0 |
| Gemini | `@google/gemini-cli`        | `GEMINI_CLI_VERSION`  | 0.29.5 |
| Kimi   | `kimi-cli` (PyPI)           | `KIMI_CLI_VERSION`    | 1.30.0 |
| OpenCode | `opencode` (GitHub release) | `OPENCODE_VERSION` | 1.3.17 |
| GLM    | `opencode` (against LiteLLM proxy) | `OPENCODE_VERSION` | 1.4.3 |

## Requirements

- Docker + docker compose
- ~10 GB disk for built agent + victim images
- API keys for the agents you want to run (see `.env.example`)
- A free local TCP port range for the per-session metrics proxy + victim

The agents themselves consume API quota — the released 630-session
matrix used roughly 6B tokens across the 5 commercial agents. Plan
for substantial spend if reproducing the full matrix.

## Quick start

```bash
cp .env.example .env
# fill in: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, KIMI_API_KEY, GLM_API_KEY

# bias_observation (free-choice) — one session
./run.sh --prompt prompts/guided.txt   --claude --mode struct      # → guided_structured
./run.sh --prompt prompts/guided.txt   --claude --mode report      # → guided_unstructured
# Unguided sessions need the output_format flag explicitly — the entrypoint
# default only resolves the guided × * combinations.
./run.sh --prompt prompts/unguided.txt --claude --mode struct \
    --output-format output_formats/unguided_structured.txt
./run.sh --prompt prompts/unguided.txt --claude --mode report \
    --output-format output_formats/unguided_unstructured.txt

# bias_injection (technique-targeted) — one session
./run.sh --prompt prompts/scen2_sqli.txt --claude --mode struct

# different victim
./run.sh --prompt prompts/scen2_ssrf.txt --gemini --mode struct --victim mlflow
```

Each run creates `results/{session_id}/` with:

```
results/juice-shop_claude_guided_structured_01/
├── session.json                     # session metadata (victim, agent, model, limits, status)
├── output/                          # agent's structured / report output
├── api-logs/
│   ├── usage.jsonl                  # per-API-call tokens + cost
│   └── *_conversations.jsonl        # full prompt/response transcripts
├── http-logs/
│   └── *_http.jsonl                 # every HTTP request the agent sent to the victim
└── analysis/
    ├── summary.json                 # token + cost totals (input to the bias_*  aggregators)
    └── (optional) *_challenges.json # juice-shop solved-challenge verification
```

Multiple sessions can run in parallel from separate shells — each gets
its own Docker network and per-session metrics proxy port.

## From a session to release-shape records

After one or more `./run.sh` invocations populate `results/`, run the
analysis pipeline:

```bash
# 1. Classify HTTP traffic per request → labeled JSONL
python ../scripts/classify/classify_attacks.py \
    results/{session}/http-logs \
    -o results/{session}/analysis \
    --victim-type juice-shop --summary

# 2. Per-session ASR + by-family verification
python ../scripts/verify/verify_success.py \
    --http-logs results/{session}/analysis/ \
    --victim-type juice-shop \
    --output results/{session}/analysis/vulnerability_results.json

# 3. Aggregate matrix-level statistics over all sessions
python ../scripts/aggregate/bias_observation.py --results-dir results/ --output ../data/bias_observation_stats.json --force
python ../scripts/aggregate/bias_injection.py   --results-dir results/ --output ../data/bias_injection_stats.json   --force

# 4. Build the released wide + long tables
python ../scripts/build_records.py
python ../scripts/build_traces.py

# 5. Same closure check the release ships
python ../scripts/verify_consistency.py --round-trip
```

## Run options (selected)

| Flag | Purpose |
|---|---|
| `--prompt <file>` | Prompt file (required). Filename selects the setting: `scen2_*` → bias_injection, otherwise bias_observation. |
| `--claude` / `--codex` / `--gemini` / `--kimi` / `--glm` / `--opencode` | Agent shorthand. |
| `--agent <name>` | Same, by name. |
| `--victim <type\|image>` | `juice-shop` (default), `vuln-shop`, `mlflow`, `bentoml`, `gradio`, `webgoat`, or any Docker image tag. |
| `--mode <report\|struct>` | Output template family (drives the `structured` / `unstructured` axis in bias_observation session ids). |
| `--{claude,codex,gemini,kimi,glm,opencode}-model <name>` | Override per-agent default model. |
| `--token-limit <n>` / `--call-limit <n>` | Hard caps via the metrics proxy (HTTP 429 once exceeded). |
| `--rerun <session_id>` | Re-execute an existing session with the same parameters captured in its `session.json`. |
| `--keep` | Leave containers up after the run for inspection. |
| `--build` | Force rebuild the agent / victim images. |

`./run.sh --help` lists everything.

## What's intentionally not here

- The released `data/` files — those live one level up (the release).
- Analysis scripts — those live one level up in `../scripts/{classify,verify,aggregate}/`,
  shared between R1 (re-analysis from released traces) and R3 (re-experiment).
- One-off migration / debug utilities used during the original data
  collection (e.g., legacy session renaming, ad-hoc CSRF debugging).
  These are not part of the reproducible pipeline.
