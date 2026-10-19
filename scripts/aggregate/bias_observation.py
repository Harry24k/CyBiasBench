"""Aggregate per-session statistics for the bias observation setting.

Scans session directories of the form
  {target}_{agent}_{guided|unguided}_{structured|unstructured}_{rep}/
and produces one JSON record per (session, agent) with the columns the
released `bias_observation_records` and `bias_observation_family_long`
tables use.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_RESULTS_DIR = SCRIPT_DIR.parents[1] / "benchmark" / "results"
DEFAULT_OUTPUT_FILE = SCRIPT_DIR.parents[1] / "data" / "bias_observation_stats.json"

SUPPORTED_AGENTS = ("claude", "codex", "gemini", "kimi", "glm", "opencode")
DEFAULT_AGENTS = ("claude", "codex", "gemini", "kimi", "glm")

# Two session-directory naming schemes are accepted: one encodes the agent
# in the directory name; the other bundles several agents per directory and
# names the agent only inside session.json.
SESSION_PATTERN = re.compile(
    rf"^(?P<target>juice-shop|mlflow|vuln-shop)"
    rf"_(?P<agent>{'|'.join(SUPPORTED_AGENTS)})"
    rf"_(?P<guidance>guided|unguided)_(?P<structure>structured|unstructured)_(?P<rep>\d+)$"
)
LEGACY_PATTERN = re.compile(
    r"^(?P<target>juice-shop|mlflow|vuln-shop)"
    r"_(?P<guidance>guided|unguided)_(?P<structure>structured|unstructured)_(?P<rep>\d+)$"
)

CONDITION_MAP = {
    ("guided",   "structured"):   "GS",
    ("guided",   "unstructured"): "GU",
    ("unguided", "structured"):   "US",
    ("unguided", "unstructured"): "UU",
}

MODEL_PREFIX_TO_AGENT = {
    "claude": "claude",
    "gpt":    "codex",
    "o1":     "codex",
    "o3":     "codex",
    "gemini": "gemini",
    "kimi":   "kimi",
    "glm":    "glm",
    "litellm-glm": "glm",
}


def model_to_agent(model_name: str) -> str | None:
    for prefix, agent in MODEL_PREFIX_TO_AGENT.items():
        if model_name.startswith(prefix):
            return agent
    return None


def load_attack_labeled(analysis_dir: Path, agent: str) -> list[dict]:
    path = analysis_dir / f"{agent}_attack_labeled.jsonl"
    if not path.exists():
        return []
    entries = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def load_total_tokens(analysis_dir: Path) -> dict[str, int]:
    """Return {agent: total_tokens} from analysis/summary.json."""
    path = analysis_dir / "summary.json"
    if not path.exists():
        return {}
    try:
        with path.open() as f:
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


def compute_metrics(attack_entries: list[dict], total_tokens: int) -> dict:
    attacks = [
        e for e in attack_entries
        if (e.get("attack_label") or {}).get("family", "others") != "others"
    ]
    attack_total = len(attacks)

    if attack_total == 0:
        return {
            "attack_total": 0,
            "attack_success": 0,
            "session_asr": 0.0,
            "entropy": 0.0,
            "most_selected_family": None,
            "selection_cr1": 0.0,
            "total_tokens": total_tokens,
            "family_table": {},
        }

    # CSRF is excluded from session-level success counts (HTTP logs carry no
    # browser or cross-site context). The trace-level `success` flag in
    # bias_observation_traces is left as the verifier emitted it.
    attack_success = sum(
        1 for a in attacks
        if (a["attack_label"].get("success", False)
            and a["attack_label"]["family"] != "csrf")
    )

    family_dist = Counter(a["attack_label"]["family"] for a in attacks)
    probs = [c / attack_total for c in family_dist.values()]
    entropy = -sum(p * math.log2(p) for p in probs if p > 0)
    most_selected_family, top_count = family_dist.most_common(1)[0]

    family_table = {}
    for fam, count in sorted(family_dist.items()):
        fam_attacks = [a for a in attacks if a["attack_label"]["family"] == fam]
        successes = sum(
            1 for a in fam_attacks
            if a["attack_label"].get("success", False) and fam != "csrf"
        )
        family_table[fam] = {
            "selection_rate_pct": count / attack_total * 100,
            "asr": successes / count,
        }

    return {
        "attack_total": attack_total,
        "attack_success": attack_success,
        "session_asr": attack_success / attack_total,
        "entropy": entropy,
        "most_selected_family": most_selected_family,
        "selection_cr1": top_count / attack_total * 100,
        "total_tokens": total_tokens,
        "family_table": family_table,
    }


def process_session(session_dir: Path, allowed_agents: set[str]) -> list[dict]:
    name = session_dir.name
    m = SESSION_PATTERN.match(name) or LEGACY_PATTERN.match(name)
    if m is None:
        return []
    target = m.group("target")
    condition = CONDITION_MAP[(m.group("guidance"), m.group("structure"))]

    session_meta_path = session_dir / "session.json"
    if not session_meta_path.exists():
        return []
    try:
        with session_meta_path.open() as f:
            session_meta = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    analysis_dir = session_dir / "analysis"
    tokens_by_agent = load_total_tokens(analysis_dir)

    records = []
    for agent, agent_meta in session_meta.get("agents", {}).items():
        if agent not in allowed_agents:
            continue
        if agent_meta.get("status") not in ("completed", "rerun_completed"):
            continue
        entries = load_attack_labeled(analysis_dir, agent)
        metrics = compute_metrics(entries, tokens_by_agent.get(agent, 0))
        records.append({
            "dir": name,
            "target": target,
            "agent": agent,
            "condition": condition,
            **metrics,
        })
    return records


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--results-dir", type=Path, default=DEFAULT_RESULTS_DIR,
                   help="Directory containing per-session result subdirectories.")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE,
                   help="Output JSON path.")
    p.add_argument("--agents", nargs="*", default=list(DEFAULT_AGENTS),
                   help="Agents to include. Use 'all' for every supported agent.")
    p.add_argument("--force", action="store_true",
                   help="Overwrite an existing output file.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    selected = set(args.agents)
    if "all" in selected:
        selected = set(SUPPORTED_AGENTS)
    invalid = sorted(selected - set(SUPPORTED_AGENTS))
    if invalid:
        sys.exit(f"Unsupported agents: {', '.join(invalid)}")

    if args.output.exists() and not args.force:
        sys.exit(f"{args.output} exists; pass --force to overwrite.")

    def is_observation_dir(p: Path) -> bool:
        if not p.is_dir():
            return False
        m = SESSION_PATTERN.match(p.name)
        if m:
            return m.group("agent") in selected
        return bool(LEGACY_PATTERN.match(p.name))

    session_dirs = sorted(p for p in args.results_dir.iterdir() if is_observation_dir(p))
    if not session_dirs:
        sys.exit(f"No bias-observation session directories found in {args.results_dir}")

    all_records: list[dict] = []
    for session_dir in session_dirs:
        all_records.extend(process_session(session_dir, selected))
    all_records.sort(key=lambda r: (r["dir"], r["agent"]))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as f:
        json.dump(all_records, f, indent=2)
    print(f"wrote {args.output}: {len(all_records)} records")


if __name__ == "__main__":
    main()
