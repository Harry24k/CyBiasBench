#!/usr/bin/env python3
"""Update the checked-in dashboard snapshot with verified release analyses.

The other paper-summary fields are retained. This is not a full regeneration of
historical paper metrics. Inputs are produced by the four release-analysis
scripts documented in dashboard/README.md; no private paper tree is required.
--check validates that the checked-in snapshot is up to date.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]


def read_verified(path, data):
    result = json.loads(path.read_text())
    hashes = result.get("input_sha256", {})
    if not hashes:
        raise ValueError(f"Missing input hashes: {path}")
    for name, expected in hashes.items():
        if Path(name).name != name:
            raise ValueError(f"Expected a data filename, got {name}")
        actual = hashlib.sha256((data / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Analysis input hash differs: {name}")
    if result["metadata"].get("human_audit_included") is not False:
        raise ValueError("This updater expects the original-label analyses")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--reviewer-stats", type=Path, default=ROOT / "analysis/reviewer_revisions/reviewer_revision_stats.json")
    parser.add_argument("--momentum-stats", type=Path, default=ROOT / "analysis/momentum/momentum_stats.json")
    parser.add_argument("--temporal-stats", type=Path, default=ROOT / "analysis/temporal/temporal_stats.json")
    parser.add_argument("--agent-stats", type=Path, default=ROOT / "analysis/agent_identification/agent_identification_stats.json")
    parser.add_argument("--summary", type=Path, default=ROOT / "dashboard/public/data/paper_summary.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    reviewer = read_verified(args.reviewer_stats, args.data_dir)
    momentum = read_verified(args.momentum_stats, args.data_dir)
    temporal = read_verified(args.temporal_stats, args.data_dir)
    identification = read_verified(args.agent_stats, args.data_dir)
    original = json.loads(args.summary.read_text())
    summary = json.loads(json.dumps(original))
    # Stop instead of silently replacing historical results if an estimator or
    # dependency change produces different metrics.
    for method, metrics in identification["metrics"].items():
        for key, value in metrics.items():
            if not math.isclose(value, original["agent_identification_rf"]["metrics"][method][key], abs_tol=1e-12):
                raise ValueError(f"Agent-identification result differs: {method}/{key}")
    prior_temporal = {row["agent"]: row for row in original["temporal_adaptation"]}
    for row in temporal["per_agent"]:
        for key, value in row.items():
            if key != "agent" and not math.isclose(value, prior_temporal[row["agent"]][key], abs_tol=1e-12):
                raise ValueError(f"Temporal result differs: {row['agent']}/{key}")
    summary["temporal_adaptation"] = temporal["per_agent"]
    summary["agent_identification_rf"] = {key: identification[key] for key in
        ("metrics", "per_agent", "feature_importance", "baseline_accuracy")}
    metadata = reviewer["metadata"]
    if metadata["bootstrap_draws"] != 20000 or metadata["bootstrap_seed"] != 20260725:
        raise ValueError("Expected the paper's 20,000-draw bootstrap with seed 20260725")
    if set(reviewer["delta_asr"]) != set(AGENTS + ["agent_equal_mean"]):
        raise ValueError("Unexpected agent set")
    for agent in AGENTS:
        estimate = reviewer["delta_asr"][agent]
        if (estimate["n_observation"], estimate["n_injection"]) != (36, 90):
            raise ValueError(f"Unexpected session counts: {agent}")
        summary["table4_compliance"][agent].update(
            obs_asr=estimate["observation"], inj_asr=estimate["injection"], delta_asr=estimate["delta"])
    for source, dest in [("compliance_selection", "compliance_sel"), ("compliance_family_asr", "compliance_asri")]:
        estimate = momentum[source]["within_agent_standardized_pooled"]
        if abs(estimate["rho"] - original["headline_stats"][dest]["rho"]) > 1e-12:
            raise ValueError(f"Momentum differs from the checked-in paper snapshot: {dest}")
        summary["headline_stats"][dest] = estimate
    summary["headline_stats"].pop("all_negative_delta_asr", None)
    summary["session_asr_uncertainty"] = {
        "estimates": reviewer["delta_asr"],
        "bootstrap_draws": metadata["bootstrap_draws"],
        "bootstrap_seed": metadata["bootstrap_seed"],
        "success_policy": metadata["success_policy"],
        "input_sha256": reviewer["input_sha256"],
    }
    if args.check:
        if summary != original:
            raise SystemExit("Dashboard summary is stale; rerun this command without --check")
        print("Dashboard release analyses match the checked-in snapshot and public input hashes.")
    else:
        args.summary.write_text(json.dumps(summary, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
        print(f"Updated {args.summary}")


if __name__ == "__main__":
    main()
