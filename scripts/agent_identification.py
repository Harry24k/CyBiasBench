#!/usr/bin/env python3
"""Reproduce random-forest agent identification from the released selection vectors."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support
from sklearn.model_selection import LeaveOneOut, StratifiedKFold, cross_val_predict

AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]
FAMILIES = ["sqli", "xss", "cmdi", "path_traversal", "auth_bypass", "idor",
            "ssrf", "csrf", "file_upload", "info_disclosure"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output-dir", type=Path, default=Path("analysis/agent_identification"))
    args = parser.parse_args()
    names = ["bias_observation_records.csv", "bias_observation_family_long.csv"]
    obs, family = [pd.read_csv(args.data_dir / name) for name in names]
    if len(obs) != 180 or not obs.record_id.is_unique:
        raise ValueError("Expected the 180 released observation sessions")
    features = family.pivot_table(index="record_id", columns="attack_family",
                                 values="selection_rate_pct", aggfunc="sum")
    features = features.reindex(index=obs.record_id, columns=FAMILIES).fillna(0.0)
    x, y = features.to_numpy(), obs.agent.to_numpy()
    # A single worker avoids nested joblib/forest process pools on small data.
    model = RandomForestClassifier(n_estimators=500, random_state=42, n_jobs=1)
    predictions, metrics = {}, {}
    for name, cv in [("leave_one_out", LeaveOneOut()),
                     ("stratified_5fold", StratifiedKFold(n_splits=5, shuffle=True, random_state=42))]:
        predictions[name] = cross_val_predict(model, x, y, cv=cv, n_jobs=1)
        metrics[name] = {"accuracy": float(accuracy_score(y, predictions[name])),
                         "macro_f1": float(f1_score(y, predictions[name], average="macro")), "n": len(y)}
        print(f"{name}: {metrics[name]}", flush=True)
    precision, recall, f1, support = precision_recall_fscore_support(
        y, predictions["leave_one_out"], labels=AGENTS, zero_division=0)
    per_agent = [{"agent": a, "precision": float(p), "recall": float(r), "f1": float(f), "support": int(n)}
                 for a, p, r, f, n in zip(AGENTS, precision, recall, f1, support)]
    model.fit(x, y)
    result = {
        "metadata": {"scikit_learn": sklearn.__version__, "trees": 500, "seed": 42,
                     "features": "released ten-family selection_rate_pct; absent families and empty sessions are zero",
                     "row_order": "bias_observation_records.csv order", "human_audit_included": False},
        "input_sha256": {name: hashlib.sha256((args.data_dir / name).read_bytes()).hexdigest() for name in names},
        "metrics": metrics, "per_agent": per_agent, "baseline_accuracy": 0.2,
        "confusion_matrix": {"labels": AGENTS, "counts": confusion_matrix(y, predictions["leave_one_out"], labels=AGENTS).tolist()},
        "feature_importance": sorted([{"feature": f, "importance": float(v)} for f, v in zip(FAMILIES, model.feature_importances_)],
                                     key=lambda row: row["importance"], reverse=True),
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "agent_identification_stats.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    pd.DataFrame({"record_id": obs.record_id, "agent": y, **predictions}).to_csv(args.output_dir / "predictions.csv", index=False)


if __name__ == "__main__":
    main()
