# Datasheet for CyBiasBench

Following Gebru et al., *Datasheets for Datasets* (CACM 2021).

## 1. Motivation

**Why was the dataset created?**
To enable quantitative study of *how five frontier LLM coding agents differ
when acting as offensive security testers*: which attack families they
prefer, how those preferences shift under prompt-condition manipulations,
how faithfully they follow family-specific instructions, and where they
systematically fail. Existing offensive-security evaluations report
aggregate attack success but rarely measure *behavioral bias* — the
agent's family-selection distribution and compliance under explicit
steering. CyBiasBench fills that gap.

**Who created the dataset?**
Taein Lim, Seongyong Ju, Munhyeok Kim, Hyunjun Kim, and Hoki Kim (Chung-Ang University and Myongji University). Taein Lim,
Seongyong Ju, and Munhyeok Kim contributed equally; Hyunjun Kim and Hoki Kim
are the corresponding authors.

**Who funded the creation?**
See the acknowledgements and funding statement in the paper.

**Was the dataset built on top of any other dataset?**
No. The records are first-party measurements collected by the authors
using public, intentionally vulnerable training applications as targets.

## 2. Composition

**What do the instances represent?**
Each row is a single experiment session: one LLM agent attacking one target
application under one configuration, replicated three times.

| File | Rows | Schema | Purpose |
|---|---|---|---|
| `data/bias_observation_records.{csv,parquet}` | 180 | wide, 11 cols | Free-choice attack sessions across 4 prompt × output-format conditions. |
| `data/bias_observation_family_long.{csv,parquet}` | 1,082 | long, 7 cols | Per-family selection / success counts in the bias observation setting. |
| `data/bias_observation_traces.{csv,parquet}` | 19,116 | request-level (paper Table 5) | Sanitized HTTP request-response traces for observation sessions. |
| `data/bias_injection_records.{csv,parquet}` | 450 | wide, 13 cols | Requested-family attack sessions across 10 requested attack families. |
| `data/bias_injection_family_long.{csv,parquet}` | 1,597 | long | Per-family attempt / success counts in the bias injection setting. |
| `data/bias_injection_traces.{csv,parquet}` | 258,019 | request-level (paper Table 5) | Sanitized HTTP request-response traces for injection sessions. |

**Design matrix.**
- 5 agents (claude, codex, gemini, kimi, glm) × 3 targets × 4 conditions × 3 reps = 180 (bias observation).
- 5 agents × 3 targets × 10 requested attack families × 3 reps = 450 (bias injection).
All cells are completely populated (verified by `scripts/verify_consistency.py`).

**Are there any missing values?**
- `most_selected_family` is null in 1 of 180 bias-observation rows
  (zero-attack session).
- `requested_family_asr` is reported as `0.0` in the 83 of 450 injection rows where
  `requested_family_attempts == 0` (the agent never attempted the requested family
  in that session); always paired with `compliance == 0`, so the
  zero-denominator case is unambiguous.

**Is any information confidential, sensitive, or PII?**
No personal data. Targets are public training apps with synthetic accounts
(see §5). Agent reasoning text and raw exploit payload bodies are *not*
part of this release; sanitized request-level traces accompany the aggregates.
See `RESPONSIBLE_USE.md`.

**Does the dataset relate to people?**
No.

**Are there errors, sources of noise, or redundancies?**
- Attack classification uses an OWASP Core Rule Set–derived ruleset.
  False positives (benign requests labeled as attacks) and false negatives
  (attacks the rules miss) are bounded but nonzero. The classifier code is
  released alongside, so reviewers and reusers can audit and rerun.
- Successful-attack detection uses response-content heuristics and target-specific
  rules. A 2xx response, reflection, stored URL, or command string does not by
  itself prove exploitation. Automatic positives can be wrong or remain
  insufficiently supported by the recorded evidence.
- *CSRF success policy.* Trace `success` flags include victim-specific
  CSRF state-change detections; the aggregate `attack_success`
  conservatively excludes CSRF success because state changes are not
  conclusively verifiable from the HTTP intercept alone. See
  `schema/columns_traces.md` §"CSRF success accounting".
- 11 families appear in long-form selection counts, but the bias injection
  setting requests only 10 (deserialization is observed but never requested).

## 3. Collection process

**How was the data acquired?**
Through a Docker-isolated harness in which the LLM agent is given a target
URL and a natural-language attack prompt, then given direct shell access to
a Kali-based container with standard offensive tools (`nmap`, `sqlmap`,
`nikto`, `curl`, etc.). All HTTP traffic between agent and target is
captured by an intercepting proxy (mitmproxy); all LLM API calls are
captured by a LiteLLM proxy. The recorded numbers in this release are
aggregates derived by the released analysis pipeline from those traces.

**Time frame of collection.**
February 2026 to April 2026.

**Sampling strategy.**
Full factorial: every cell in the design matrix received the same number of
repetitions (three).

**Who was involved?**
The authors and their automated harness collected the sessions. Human experts
separately reviewed family labels and response-ambiguous automatic positives;
their review did not generate the original automatic trace labels. This release
retains those original automatic labels and does not include human verdict
sheets or human-corrected success-policy results.

**Was an ethical review conducted?**
No human subjects, no real systems, and no real personal data are involved.
IRB review was therefore not applicable. Dual-use considerations for the
data and code are addressed in §6 and in `RESPONSIBLE_USE.md`.

## 4. Preprocessing / labeling

The released tabular records are produced by the included analysis
pipeline:

1. HTTP traffic is classified by an OWASP CRS-derived rule set into
   `auth_bypass`, `cmdi`, `csrf`, `deserialization`, `file_upload`, `idor`,
   `info_disclosure`, `path_traversal`, `sqli`, `ssrf`, `xss`, or "non-attack".
2. Successful attacks are flagged using response-content heuristics
   (status codes, error leaks, payload reflection, Juice Shop's
   `/api/Challenges/` endpoint where applicable).
3. Per-session aggregates (counts, session ASR, entropy, most-selected family, Selection CR1) are computed.
4. Records are emitted to CSV / Parquet via `scripts/build_records.py`.

Sanitized request-level traces accompany the aggregates and let reviewers
recompute every metric end-to-end. The classifier rule set and the
end-to-end harness used to produce these traces are released alongside this
dataset in the broader submission artifact described in the paper's
Appendix *Artifact and Data Schema*.

## 5. Uses

**For what tasks should the dataset be used?**
- Quantitative study of LLM-agent behavioral bias in offensive security tasks.
- Comparison of evaluation designs (guided vs unguided prompts; structured
  vs unstructured outputs).
- Benchmarking new evaluation metrics for offensive-agent behavior.
- Auditing methodologies for family-selection imbalance in LLM-driven
  security pipelines.

**For what tasks should it not be used?**
- Training or fine-tuning models to *attack* real systems.
- Extraction of jailbreak prompts or working exploit payloads (the release
  does not contain payload text at the byte level).
- Production claims about agent capability against unseen real systems
  without further validation.

**Are there tasks for which the dataset should not be used?**
The dataset is *not* a leaderboard for "how good is my model at hacking
real systems." It is a measurement of behavioral structure on three
intentionally vulnerable training apps; rankings here will not transfer
linearly to arbitrary targets.

Family allocation also depends on availability, discoverability, execution
difficulty, request costs, and the deployed agent's prompts and tools. The
study does not establish intrinsic model preference or causally disentangle
these factors. Large-scale decision utility and superiority to simple
diversity-based agent-selection heuristics remain unestablished.

## 6. Distribution

**Where is the dataset distributed?**
- Source repository: <https://github.com/Harry24k/CyBiasBench> (versioned with git tags).
- Interactive result dashboard: <https://trustworthyai.co.kr/CyBiasBench/>.

**Under what license?**
- Tabular records (`data/*`) and documentation: **CC BY-NC-ND 4.0**
  (non-commercial use only; no derivative works of the dataset may be
  redistributed).
- Code (`scripts/`, `src/cybiasbench/`): **MIT**.

**What about raw exploit payloads and agent reasoning transcripts?**
Not redistributed. Sanitized traces retain everything needed to reclassify
or rescore any session, but redact payload bodies and agent reasoning text.
The harness, classifier, and verifier are released, so independent
collection of new traces is possible. See `RESPONSIBLE_USE.md` for the
sanitization protocol and the rationale.

**Are there usage restrictions?**
CC BY-NC-ND 4.0 applies: attribution is required, commercial use is not
permitted, and modified or derivative versions of the dataset may not be
redistributed. Use must comply with the targets' licenses (Juice Shop,
MLflow, and the in-house *vuln-shop* image are all permissive educational
artifacts) and each LLM provider's terms of service. Users must
additionally honor `RESPONSIBLE_USE.md`.

## 7. Maintenance

**Who maintains the dataset?**
The authors listed in §1. Corresponding authors: Hyunjun Kim
(hjkim1@mju.ac.kr) and Hoki Kim (hokikim@cau.ac.kr).

**How often will it be updated?**
We expect at most yearly updates (new agents, new targets, new attack
families). Bug-fix releases will be issued as needed.

**Will old versions be retained?**
Yes — versioned via git tags on the source repository, with dataset
revisions retained on the hosting mirror when applicable.

**How can errors or contributions be reported?**
Through the repository's issue tracker (<https://github.com/Harry24k/CyBiasBench/issues>) or by email to
the corresponding authors.
