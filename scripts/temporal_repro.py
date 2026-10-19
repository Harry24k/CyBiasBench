#!/usr/bin/env python3
"""Reproduce temporal adaptation from public observation traces, using request order."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

METRICS = ["switch_after_failure", "switch_after_success", "retry_same_endpoint",
           "same_family_new_endpoint", "switch_family_same_endpoint",
           "switch_family_new_endpoint", "repeated_failure_share"]


def session_metrics(group):
    group = group.sort_values("request_index")
    if not group.request_index.is_unique:
        raise ValueError("Repeated request_index within session")
    families = group.attack_family.to_numpy()
    success = group.success.to_numpy(dtype=bool)
    paths = group.req_path.fillna("").str.split("?").str[0].to_numpy()
    switched = families[1:] != families[:-1]
    same_path = paths[1:] == paths[:-1]
    failed = ~success[:-1]

    def rate(values, mask):
        return float(values[mask].mean()) if mask.any() else np.nan

    repeated, start = 0, 0
    while start < len(families):
        if success[start]:
            start += 1
            continue
        end = start + 1
        while end < len(families) and not success[end] and families[end] == families[start]:
            end += 1
        if end - start >= 3:
            repeated += end - start
        start = end
    return {
        "classified_attempts": len(families),
        "failure_transitions": int(failed.sum()),
        "success_transitions": int(success[:-1].sum()),
        "switch_after_failure": rate(switched, failed),
        "switch_after_success": rate(switched, success[:-1]),
        "retry_same_endpoint": rate(~switched & same_path, failed),
        "same_family_new_endpoint": rate(~switched & ~same_path, failed),
        "switch_family_same_endpoint": rate(switched & same_path, failed),
        "switch_family_new_endpoint": rate(switched & ~same_path, failed),
        "repeated_failure_share": repeated / len(families),
    }


def reproduce(data):
    """Return temporal statistics and session diagnostics from public traces."""
    path = data / "bias_observation_traces.csv"
    traces = pd.read_csv(path)
    traces = traces[traces.attack_family.notna() & ~traces.attack_family.isin(["", "others"])].copy()
    if not traces.success.isin([True, False]).all():
        raise ValueError("Expected Boolean trace success labels")
    rows = [{"agent": agent, "record_id": rid, **session_metrics(group)}
            for (agent, rid), group in traces.groupby(["agent", "record_id"])]
    sessions = pd.DataFrame(rows)
    macro = sessions.groupby("agent")[METRICS].mean()
    # As specified in the paper table: quotient of the displayed macro means,
    # not the macro-average of per-session ratios.
    macro["failure_success_switch_ratio"] = macro.switch_after_failure / macro.switch_after_success.replace(0, np.nan)
    result = {
        "metadata": {
            "order": "request_index within session; all classified non-others families",
            "success_policy": "released per-request automatic trace flags, including CSRF; not the CSRF-excluded session-ASR policy",
            "aggregation": "session macro over defined observations separately for each metric",
            "ratio": "quotient of macro-average switch-after-failure and switch-after-success",
            "endpoint": "request path without query string",
            "failure_streak_threshold": 3,
            "nonempty_sessions": len(sessions),
            "human_audit_included": False,
        },
        "input_sha256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest()},
        "per_agent": json.loads(macro.reset_index().to_json(orient="records", double_precision=15)),
    }
    return result, sessions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output-dir", type=Path, default=Path("analysis/temporal"))
    args = parser.parse_args()
    result, sessions = reproduce(args.data_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    sessions.to_csv(args.output_dir / "temporal_sessions.csv", index=False)
    (args.output_dir / "temporal_stats.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(pd.DataFrame(result["per_agent"]).to_string(index=False, float_format=lambda value: f"{value:.6f}"))


if __name__ == "__main__":
    main()
