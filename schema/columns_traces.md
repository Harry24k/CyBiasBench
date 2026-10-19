# Sanitized request-level traces

Two files, one per setting:
- `bias_observation_traces.csv` — 19,116 rows
- `bias_injection_traces.csv` — 258,019 rows

Schema follows the paper's Appendix *Artifact and Data Schema*, Table 5.

## Columns

| Column | Type | Description |
|---|---|---|
| `record_id` | string | Foreign key into `bias_observation_records.record_id` or `bias_injection_records.record_id`. |
| `scenario` | enum | `bias_observation` or `bias_injection`. |
| `target` | enum | `juice-shop`, `mlflow`, or `vuln-shop`. |
| `agent` | enum | `claude`, `codex`, `gemini`, `kimi`, `glm`. |
| `request_index` | int | Zero-based request order within each `record_id`. Absolute timestamps are not retained. |
| `req_method` | string | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, …). |
| `req_path` | string | Request path with query string. Control characters (NUL, CR, LF, etc.) are replaced with single spaces. Bodies and headers are **not** retained. |
| `resp_status_code` | int | HTTP response status code. |
| `attack_family` | enum | One of the 11 attack families or `others` for non-attack traffic: `auth_bypass`, `cmdi`, `csrf`, `deserialization`, `file_upload`, `idor`, `info_disclosure`, `path_traversal`, `sqli`, `ssrf`, `xss`, `others`. |
| `matched_rules` | string | Classifier rule identifiers as a semicolon-separated string. |
| `capec_id` | string \| null | CAPEC mapping for the assigned family (e.g., `CAPEC-118`). Null when `attack_family` is `others`. |
| `cwe_id` | string \| null | CWE mapping for the assigned family (e.g., `CWE-200`). Null when `attack_family` is `others`. |
| `success` | bool | Verifier success flag for this individual request. |
| `success_evidence` | string | Short non-payload evidence label from the verifier (e.g., `"Security policy file exposed: 'Policy: payment'"`). Empty when `success` is false or for non-attack rows. |

## Sanitization protocol

The released trace files are derived from raw mitmproxy logs in the experiment
harness via `scripts/build_traces.py`. The pipeline applies the following
transforms:

1. **Bodies dropped.** Request bodies and response bodies are entirely
   removed. Bodies are where the bulk of payload-text disclosure risk lives,
   so we redact them at this stage.
2. **Headers dropped.** All request and response headers (User-Agent,
   Cookie, Authorization, custom CSRF tokens, etc.) are removed.
3. **Absolute timestamps dropped.** Raw event timestamps are removed. The
   release keeps only a zero-based `request_index` per `record_id` to
   preserve within-session request order.
4. **Path control bytes stripped.** `req_path` may legitimately carry
   payloads in query strings (e.g., `?id=1' OR '1'='1`). We preserve those
   characters but replace any low-ASCII control byte (NUL, CR, LF, …) with
   a single space, since control bytes break CSV writers and are not needed
   downstream.
5. **Environment identifiers normalized.** Internal container hostnames exist
   only in the request URL; we drop the full URL and keep the path only. Run
   UUIDs are not present in the released records.

## Relationship to the aggregate records

Per `record_id`, the count of trace rows with `attack_family != 'others'` equals
`attack_total` in the corresponding aggregate record, and per-family sums
match the long-form `attempts` columns. `verify_consistency.py` enforces
this end-to-end.

### CSRF success accounting

CSRF success is accounted for differently by design between the two
layers. The per-request `success` flag is produced by the
target-specific classifier, which can detect state-change-style CSRF
success on the targets that expose state-tracking endpoints
(juice-shop, vuln-shop). The aggregate `attack_success` count in the
records files conservatively *excludes* CSRF success because state
changes are not conclusively verifiable from the HTTP intercept alone.
For example, a CSRF-targeted vuln-shop session can list a dozen
`success = true` CSRF rows in the trace file while reporting
`attack_success = 0` in the records file. Sum-up consistency therefore
holds for every attack family *except* CSRF; the records value is
authoritative for paper figures and tables.
