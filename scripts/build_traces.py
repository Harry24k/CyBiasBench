"""Convert labeled HTTP traces into the CyBiasBench sanitized trace release.

Reads per-session labeled JSONL produced by the experiment harness and
writes the two trace tables (CSV + Parquet) following paper Table 5. See
`schema/columns_traces.md` and `RESPONSIBLE_USE.md` for the sanitization
protocol.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RESULTS = REPO_ROOT / "benchmark" / "results"
DEFAULT_STATS = REPO_ROOT / "data"
DEFAULT_OUT = REPO_ROOT / "data"

TRACE_COLUMNS = [
    "record_id",
    "scenario",
    "target",
    "agent",
    "request_index",
    "req_method",
    "req_path",
    "resp_status_code",
    "attack_family",
    "matched_rules",
    "capec_id",
    "cwe_id",
    "success",
    "success_evidence",
]


def make_record_id(dir_name: str, agent: str) -> str:
    # Mirrors build_records.make_record_id; multi-agent session dirs append
    # the agent name to disambiguate.
    return dir_name if f"_{agent}_" in dir_name else f"{dir_name}__{agent}"


def load_session_index(stats_path: Path, setting: str) -> dict[tuple[str, str], dict]:
    """Map (session_dir, agent) -> metadata, indexing by the keys that
    `iter_session_files` emits. The `setting` value flows into the
    `scenario` column of the released trace tables."""
    with stats_path.open() as f:
        records = json.load(f)
    index: dict[tuple[str, str], dict] = {}
    for r in records:
        key = (r["dir"], r["agent"])
        index[key] = {
            "scenario": setting,
            "target": r["target"],
            "condition": r.get("condition"),
            "requested_family": r.get("requested_family"),
        }
    return index


def iter_session_files(results_dir: Path):
    for jsonl in sorted(results_dir.glob("*/analysis/*_attack_labeled.jsonl")):
        session_dir = jsonl.parent.parent.name
        agent = jsonl.stem.replace("_attack_labeled", "")
        yield session_dir, agent, jsonl


def sanitize_record(line: str, meta: dict, record_id: str, request_index: int) -> dict | None:
    try:
        d = json.loads(line)
    except json.JSONDecodeError:
        return None
    label = d.get("attack_label") or {}
    request = d.get("request") or {}
    response = d.get("response") or {}
    return {
        "record_id": record_id,
        "scenario": meta["scenario"],
        "target": meta["target"],
        "agent": d.get("agent"),
        "request_index": request_index,
        "req_method": request.get("method"),
        "req_path": request.get("path"),
        "resp_status_code": response.get("status_code"),
        "attack_family": label.get("family"),
        "matched_rules": ";".join(label.get("matched_rules") or []),
        "capec_id": label.get("capec_id"),
        "cwe_id": label.get("cwe_id"),
        "success": bool(label.get("success", False)),
        "success_evidence": label.get("success_evidence") or "",
    }


def collect(setting: str, results_dir: Path, index: dict) -> pd.DataFrame:
    rows: list[dict] = []
    n_sessions = 0
    n_skipped = 0
    for session_dir, agent, jsonl in iter_session_files(results_dir):
        meta = index.get((session_dir, agent))
        if meta is None:
            n_skipped += 1
            continue
        rid = make_record_id(session_dir, agent)
        with jsonl.open() as f:
            request_index = 0
            for line in f:
                row = sanitize_record(line, meta, rid, request_index)
                if row is not None:
                    rows.append(row)
                    request_index += 1
        n_sessions += 1
    print(f"  {setting}: {n_sessions} sessions, {n_skipped} skipped, {len(rows)} requests")
    return pd.DataFrame(rows, columns=TRACE_COLUMNS)


def write_outputs(df: pd.DataFrame, stem: Path) -> None:
    import csv

    # Path-traversal payloads can carry NUL / CR / LF in req_path, which
    # break CSV writers; substitute a single space.
    text_cols = ["req_path", "success_evidence", "matched_rules"]
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(
                r"[\x00-\x1f\x7f]+", " ", regex=True
            )

    csv_path = stem.with_suffix(".csv")
    pq_path = stem.with_suffix(".parquet")
    df.to_csv(csv_path, index=False, quoting=csv.QUOTE_NONNUMERIC)
    df_pq = df.copy()
    df_pq["matched_rules"] = df_pq["matched_rules"].apply(
        lambda s: s.split(";") if isinstance(s, str) and s else []
    )
    df_pq.to_parquet(pq_path, index=False)
    csv_size = csv_path.stat().st_size
    pq_size = pq_path.stat().st_size
    print(f"wrote {csv_path.name}: {len(df)} rows ({csv_size/1024:.0f} KB CSV)")
    print(f"wrote {pq_path.name}: {len(df)} rows ({pq_size/1024:.0f} KB Parquet)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", type=Path, default=DEFAULT_RESULTS,
                    help="Experiment results directory (one subdir per session).")
    ap.add_argument("--stats", type=Path, default=DEFAULT_STATS,
                    help="Directory containing the aggregator JSON outputs.")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help="Output directory for trace CSV / Parquet.")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    obs_index = load_session_index(args.stats / "bias_observation_stats.json",
                                   "bias_observation")
    obs_df = collect("bias_observation", args.results, obs_index)
    write_outputs(obs_df, args.out / "bias_observation_traces")

    inj_index = load_session_index(args.stats / "bias_injection_stats.json",
                                   "bias_injection")
    inj_df = collect("bias_injection", args.results, inj_index)
    write_outputs(inj_df, args.out / "bias_injection_traces")


if __name__ == "__main__":
    main()
