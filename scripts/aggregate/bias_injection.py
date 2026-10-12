"""Aggregate per-session statistics for the bias injection setting.

Scans session directories of the form
  {target}[_{agent}]_scen2_{family}_{rep}/
and produces one JSON record per (session, agent) with the columns the
released `bias_injection_records` and `bias_injection_family_long`
tables use.

CSRF success-exclusion policy: this script reads
analysis/vulnerability_results.json, which is produced by
`scripts/verify/verify_success.py`. That verifier already excludes CSRF
success from per-family `succeeded` counts (see `aggregate_results` in verify_success.py),
so `attack_success` and the per-family `success` count here are CSRF-
free by construction. The trace-level `success` flag in
bias_injection_traces preserves the victim-specific classifier's
unfiltered observation.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_RESULTS_DIR = SCRIPT_DIR.parents[1] / "benchmark" / "results"
DEFAULT_OUTPUT_FILE = SCRIPT_DIR.parents[1] / "data" / "bias_injection_stats.json"

TARGETS = ("juice-shop", "mlflow", "vuln-shop")
AGENTS = ("claude", "codex", "gemini", "kimi", "glm", "opencode")

# Released session dirs use either {target}_scen2_{family}_{rep} (bundled)
# or {target}_{agent}_scen2_{family}_{rep} (per-agent).
SESSION_PATTERN = re.compile(
    r"^(?:" + "|".join(re.escape(t) for t in TARGETS) + r")"
    r"(?:_(?:" + "|".join(AGENTS) + r"))?_scen2_(.+)_(\d+)$"
)


def parse_target_and_rep(dir_name: str) -> tuple[str, str]:
    m = SESSION_PATTERN.match(dir_name)
    if m:
        return m.group(1), m.group(2)
    return dir_name, "01"


MODEL_PREFIX_TO_AGENT = {
    "claude": "claude",
    "gpt":    "codex",
    "o1":     "codex",
    "o3":     "codex",
    "gemini": "gemini",
    "kimi":   "kimi",
    "glm":    "glm",
}


def model_to_agent(model_name: str) -> str | None:
    for prefix, agent in MODEL_PREFIX_TO_AGENT.items():
        if model_name.startswith(prefix):
            return agent
    return None


def load_total_tokens(session_dir: Path) -> dict[str, int]:
    """Return {agent: total_tokens} from analysis/summary.json."""
    summary_path = session_dir / "analysis" / "summary.json"
    if not summary_path.exists():
        return {}
    try:
        with summary_path.open() as f:
            summary = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    out: dict[str, int] = {}
    for model_name, model_data in summary.get("models", {}).items():
        agent = model_to_agent(model_name)
        if agent is None:
            continue
        out[agent] = out.get(agent, 0) + model_data.get("total_tokens", 0)
    return out


def process_session(session_dir: Path) -> list[dict]:
    name = session_dir.name
    target_family, rep = parse_target_and_rep(name)

    session_meta_path = session_dir / "session.json"
    if not session_meta_path.exists():
        return []
    try:
        with session_meta_path.open() as f:
            session_meta = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    target = session_meta.get("victim", {}).get("type", "juice-shop")

    vuln_path = session_dir / "analysis" / "vulnerability_results.json"
    if not vuln_path.exists() or vuln_path.stat().st_size < 100:
        return []
    try:
        with vuln_path.open() as f:
            vuln = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    by_agent_vuln = vuln.get("by_agent", {})
    tokens_by_agent = load_total_tokens(session_dir)

    records = []
    for agent, agent_meta in session_meta.get("agents", {}).items():
        if agent_meta.get("status") not in ("completed", "rerun_completed"):
            continue

        agent_vuln = by_agent_vuln.get(agent, {})
        attack_total = agent_vuln.get("total_attack_requests", 0)
        attack_success = agent_vuln.get("successful_attacks", 0)
        by_family_raw = agent_vuln.get("by_family", {})

        family_table = {
            fam: {
                "attempts": fdata.get("attempted", 0),
                "success":  fdata.get("succeeded", 0),
            }
            for fam, fdata in by_family_raw.items()
        }
        requested_family_attempts = family_table.get(target_family, {}).get("attempts", 0)
        requested_family_successes = family_table.get(target_family, {}).get("success", 0)

        records.append({
            "dir": name,
            "target": target,
            "agent": agent,
            "requested_family": target_family,
            "rep": rep,
            "attack_total": attack_total,
            "attack_success": attack_success,
            "session_asr": round(attack_success / attack_total, 4) if attack_total else 0.0,
            "requested_family_attempts": requested_family_attempts,
            "requested_family_successes": requested_family_successes,
            "requested_family_asr": round(requested_family_successes / requested_family_attempts, 4)
            if requested_family_attempts else 0.0,
            "compliance": round(requested_family_attempts / attack_total, 4) if attack_total else 0.0,
            "total_tokens": tokens_by_agent.get(agent, 0),
            "family_table": family_table,
        })
    return records


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--results-dir", type=Path, default=DEFAULT_RESULTS_DIR,
                   help="Directory containing per-session result subdirectories.")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE,
                   help="Output JSON path.")
    p.add_argument("--force", action="store_true",
                   help="Overwrite an existing output file.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.output.exists() and not args.force:
        sys.exit(f"{args.output} exists; pass --force to overwrite.")

    session_dirs = sorted(
        p for p in args.results_dir.iterdir()
        if p.is_dir() and SESSION_PATTERN.match(p.name)
    )
    if not session_dirs:
        sys.exit(f"No bias-injection session directories found in {args.results_dir}")

    all_records: list[dict] = []
    for session_dir in session_dirs:
        all_records.extend(process_session(session_dir))
    all_records.sort(key=lambda r: (r["dir"], r["agent"]))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as f:
        json.dump(all_records, f, indent=2)
    print(f"wrote {args.output}: {len(all_records)} records")


if __name__ == "__main__":
    main()
