#!/usr/bin/env python3
"""Reproduce compliance correlations from the released observation/injection CSVs.

The paper's estimator pools the 50 agent-family cells after standardizing each
variable within each agent (population SD). Raw pooling and mean per-agent rho
are reported separately; they are different estimators.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]
FAMILIES = ["sqli", "xss", "cmdi", "path_traversal", "auth_bypass", "idor",
            "ssrf", "csrf", "file_upload", "info_disclosure"]
INPUTS = ["bias_observation_records.csv", "bias_observation_family_long.csv",
          "bias_injection_records.csv"]


def correlations(cells, predictor):
    raw_x, raw_y, standardized_x, standardized_y = [], [], [], []
    per_agent = {}
    for agent in AGENTS:
        group = cells[cells.agent == agent]
        x = group[predictor].to_numpy()
        y = group.compliance.to_numpy()
        if len(x) != 10 or not np.isfinite([x, y]).all():
            raise ValueError(f"Expected ten finite family cells for {agent}")
        raw_x.extend(x)
        raw_y.extend(y)
        standardized_x.extend((x - x.mean()) / (x.std(ddof=0) or 1.0))
        standardized_y.extend((y - y.mean()) / (y.std(ddof=0) or 1.0))
        per_agent[agent] = float(spearmanr(x, y).statistic)

    def result(x, y):
        rho, p = spearmanr(x, y)
        return {"rho": float(rho), "p": float(p), "n": len(x)}

    return {"within_agent_standardized_pooled": result(standardized_x, standardized_y),
            "raw_pooled": result(raw_x, raw_y),
            "mean_per_agent_rho": float(np.mean(list(per_agent.values()))),
            "per_agent_rho": per_agent}


def reproduce(data):
    obs, family, inj = [pd.read_csv(data / name) for name in INPUTS]
    if len(obs) != 180 or len(inj) != 450 or not obs.record_id.is_unique:
        raise ValueError("Expected the released 180 observation and 450 injection sessions")
    family = family[family.attack_family.isin(FAMILIES)].merge(
        obs[["record_id", "attack_total"]], on="record_id", validate="many_to_one")
    # Preserve the figure's estimator, including the precision of released
    # selection rates and ASR_i. Do not round these reconstructed counts.
    family["attempts"] = family.selection_rate_pct / 100.0 * family.attack_total
    family["successes"] = family.attempts * family.asr.fillna(0.0)
    index = pd.MultiIndex.from_product([AGENTS, FAMILIES], names=["agent", "attack_family"])
    totals = family.groupby(["agent", "attack_family"])[["attempts", "successes"]].sum()
    cells = totals.reindex(index, fill_value=0)
    cells["selection"] = cells.attempts / cells.groupby(level="agent").attempts.transform("sum")
    # The figure assigns ASR_i zero to an unattempted family.
    cells["family_asr"] = (cells.successes / cells.attempts.replace(0, np.nan)).fillna(0.0)
    compliance = inj.groupby(["agent", "requested_family"]).compliance.agg(["mean", "size"])
    compliance.index = compliance.index.set_names(index.names)
    if not compliance.reindex(index)["size"].eq(9).all():
        raise ValueError("Expected nine injection sessions per agent-family cell")
    cells["compliance"] = compliance["mean"]
    cells = cells.reset_index()
    result = {
        "metadata": {
            "estimator": "Spearman over 50 cells after within-agent z-standardization (ddof=0)",
            "observation": "pooled family counts reconstructed from released selection_rate_pct and asr",
            "compliance": "mean of nine injection sessions per agent-family cell",
            "unattempted_family_asr": 0,
            "p_values": "two-sided, unadjusted; paper interprets significance with Bonferroni correction",
            "human_audit_included": False,
        },
        "input_sha256": {name: hashlib.sha256((data / name).read_bytes()).hexdigest() for name in INPUTS},
        "compliance_selection": correlations(cells, "selection"),
        "compliance_family_asr": correlations(cells, "family_asr"),
    }
    return result, cells


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output-dir", type=Path, default=Path("analysis/momentum"))
    args = parser.parse_args()
    result, cells = reproduce(args.data_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "momentum_stats.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    cells.to_csv(args.output_dir / "momentum_cells.csv", index=False)
    print(json.dumps({k: result[k]["within_agent_standardized_pooled"]
                      for k in ("compliance_selection", "compliance_family_asr")}, indent=2))


if __name__ == "__main__":
    main()
