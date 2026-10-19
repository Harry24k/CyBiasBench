# Responsible Use

CyBiasBench characterizes LLM offensive-agent behavior. The data and code
support defensive research (measuring how off-the-shelf LLM agents are biased
when used as security testers) but, with effort, could also inform misuse.
This document states what we publish, what we deliberately withhold, and what
we ask of users.

## What this release contains

The CyBiasBench v1.0.0 dataset release in this directory consists of:

- **Aggregated session statistics** — per-session counts, ratios, and
  distributional metrics for all 630 sessions
  (`data/bias_observation_records.{csv,parquet}`,
  `data/bias_observation_family_long.{csv,parquet}`,
  `data/bias_injection_records.{csv,parquet}`,
  `data/bias_injection_family_long.{csv,parquet}`).
- **Sanitized request-level traces** — the HTTP request stream that
  produced those aggregates, with bodies, headers, and absolute timestamps
  dropped; per-session request order is retained as `request_index`; and
  request paths' control bytes are stripped
  (`data/bias_observation_traces.{csv,parquet}`,
  `data/bias_injection_traces.{csv,parquet}`).
- **Schema and glossary documentation** under `schema/`.
- **Loader and build / verify scripts** under `src/cybiasbench/` and
  `scripts/` (MIT-licensed) sufficient to reproduce the released CSV /
  Parquet files from the upstream labeled JSONL artifacts shipped in the
  paper's supplementary archive.
- **Croissant metadata** (`croissant.json`) including the minimal
  Responsible-AI fields required by the NeurIPS Evaluations & Datasets
  Track.

The classifier rule set, response-heuristic verifier, end-to-end experiment
harness (Docker runner, agent containers, target deployment scripts,
metrics proxy, HTTP logger), and figure / table reproduction scripts are
distributed alongside this dataset in the broader submission artifact
described in the paper's Appendix *Artifact and Data Schema*.

## What we deliberately do not release

- **Raw exploit payload bodies** — the literal bytes of attack payloads
  (e.g., the exact SQL injection strings, command injection payloads,
  serialized RCE blobs) are stripped from request bodies before release.
  Sanitized traces retain enough signal to reproduce family classification
  and ASR (request order, path, status, classifier label, success flag,
  short evidence string) but not to extract working exploit text directly.
- **Verbatim agent reasoning transcripts** — full LLM conversation logs
  that contain explicit bypass strategies and chain-of-thought reasoning
  about exploitation are not part of the release. Aggregate token counts
  and per-session derived metrics are.

The aggregated counts in this release are sufficient to reproduce every
claim in the accompanying paper, and the sanitized traces support
reclassifying or recomputing metrics — providing reproducibility without
redistributing payload text or chain-of-thought transcripts.

## Conditions of use

By using CyBiasBench you agree to:

1. Use the data and code for **defensive, academic, or measurement-oriented
   research**. Examples: studying agent bias, building evaluation
   methodologies, auditing offensive-agent pipelines, training classifiers
   that *detect* such agents.
2. **Not** use the data, code, or models trained on them to attack systems
   without explicit authorization from the system owner.
3. **Not** redistribute reconstructed payload text. If you collect raw
   traces using the released harness, apply at minimum the sanitization
   protections listed below before sharing.
4. Honor the licenses of the upstream target applications (Juice Shop,
   MLflow, *vuln-shop*) and each LLM provider's terms of service.

## Recommended protections for derived raw data

If you extend CyBiasBench by collecting your own raw traces, we recommend:

- Strip API keys, OAuth tokens, and session cookies from logs before storage.
- Strip personally identifying information from any synthetic accounts that
  resemble real ones.
- Apply the same payload sanitization used in this release (drop request
  bodies, headers, and absolute timestamps; retain request order, status,
  family label, success flag, sanitized path).
- Host raw traces under credentialized access (e.g., PhysioNet-style review
  process) rather than open download.

## Reporting concerns

If you identify a concrete way in which the released artifacts enable misuse
that we did not anticipate, please open an issue on the repository or, for
reports that should not be public, email the corresponding authors
(hokikim@cau.ac.kr, hjkim1@mju.ac.kr) so we can revise this document and,
if necessary, the release.

## Limitations of these mitigations

We acknowledge that no static document prevents determined misuse. The
effective mitigations are: (a) releasing aggregates plus sanitized traces
without raw payload text, (b) targeting only intentionally vulnerable
training applications so that the agent behavior we measure is in the
setting where breaking the target is the *intended* outcome, and (c) being
explicit about scope so that users do not over-generalize results to
deployed real systems.
