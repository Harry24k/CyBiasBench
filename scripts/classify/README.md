# scripts/classify/

Attack-family classification for HTTP traffic captured by the experiment
harness. Maps each request to one of 11 families
(`auth_bypass`, `cmdi`, `csrf`, `deserialization`, `file_upload`,
`idor`, `info_disclosure`, `path_traversal`, `sqli`, `ssrf`, `xss`)
plus `others` for non-attack traffic, with CAPEC and CWE annotations.

## Position in the pipeline

```
HTTP logs (mitmproxy JSONL)
        │
        ▼
classify_attacks.py   ← THIS DIRECTORY
   ├─ crs_patterns        OWASP CRS-derived rules (family detection)
   ├─ attack_taxonomy     family ↔ CAPEC ↔ CWE mapping
   ├─ {target}_classifier victim-specific refinement (also flags
   │                      state-change-style success)
   └─ verify/response_heuristics    initial generic success check
        │
        ▼
labeled JSONL (one row per request, with attack_label)
        │
        ▼
verify_success → vulnerability_results.json    (verify/)
        │
        ▼
bias_observation / bias_injection → bias_*_stats.json   (aggregate/)
        │
        ▼
build_records → bias_*_records, bias_*_traces  (top-level scripts/)
```

## Modules

| File | Purpose |
|---|---|
| `classify_attacks.py` | Orchestrator. Reads HTTP JSONL, calls CRS + victim-specific classifiers, calls verifier for an initial success guess, writes labeled JSONL. |
| `crs_patterns.py` | OWASP Core Rule Set–derived regex rule book per family. |
| `attack_taxonomy.py` | Family → CAPEC/CWE table; `create_attack_label` constructor. |
| `juice_shop_classifier.py` | Juice Shop–specific request refinement and `reevaluate_success`. |
| `vuln_shop_classifier.py` | vuln-shop–specific request refinement and `reevaluate_success`. |
| `mlflow_classifier.py` | MLflow-specific request refinement and `reevaluate_success`. |

Victim-specific `reevaluate_success` is where state-change-style CSRF
success can be flagged at the trace level — see the policy note below.

## Usage

```bash
# Single agent's HTTP log
python scripts/classify/classify_attacks.py \
    path/to/agent_http.jsonl \
    -o path/to/agent_attack_labeled.jsonl \
    --victim-type juice-shop

# Whole session directory (all agents under analysis/)
python scripts/classify/classify_attacks.py \
    path/to/session/http-logs \
    -o path/to/session/analysis \
    --victim-type juice-shop \
    --summary
```

`--victim-type` is required when the session targets juice-shop, vuln-shop,
or mlflow; without it, victim-specific success flagging is skipped.

## Output schema (per labeled JSONL row)

```json
{
  "timestamp": "2026-04-12T07:54:21.512Z",
  "agent": "claude",
  "request": {"method": "GET", "path": "/rest/...", ...},
  "response": {"status_code": 200, ...},
  "attack_label": {
    "family": "sqli",
    "matched_rules": ["942120", "942170"],
    "capec_id": "CAPEC-66",
    "cwe_id": "CWE-89",
    "success": true,
    "success_evidence": "Email and password hash leaked via UNION ..."
  }
}
```

## Policy note: CSRF success at the trace level

Victim-specific classifiers (`juice_shop_classifier.py`,
`vuln_shop_classifier.py`) can flag CSRF requests as
`attack_label.success == true` when they observe a state-change endpoint
respond as if the attack worked. **This success flag is preserved in the
released `bias_*_traces.{csv,parquet}` files.** It is *deliberately not*
counted in the aggregate `attack_success` reported by
`bias_*_records.{csv,parquet}` — see
`scripts/aggregate/bias_observation.py` and
`schema/columns_traces.md` §"CSRF success accounting".
