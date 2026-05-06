"""Build public/data/paper_summary.json from the authoritative paper sources.

Inputs (all authoritative, regenerated from the anonymous public release):
  - paper/data/public_release/*.csv         (raw release)
  - paper/repro/tables/*.csv                (tables shipped in the paper)
  - paper/repro/outputs/paper_metrics.md    (numeric summary)
  - paper/repro/common.py                   (shared loaders, reused)

Output:
  - public/data/paper_summary.json          (consumed by Next.js components)

The legacy public/data/paper_s{1,2}.json files are removed because no
component consumes them anymore.

Run from repo root:
  python scripts/build_site_summary.py
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "paper" / "repro"))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from common import (  # noqa: E402
    AGENTS,
    AGENT_LABEL,
    CONDITIONS,
    FAMILIES,
    agent_compliance_summary,
    condition_profiles,
    injection_cells,
    kruskal_eta2,
    load_public_release,
    pooled_observation_profiles,
    session_main_metrics,
    spearman,
)

TABLES = ROOT / "paper" / "repro" / "tables"
OUTPUT = ROOT / "public" / "data" / "paper_summary.json"
LEGACY_PURGE = [
    ROOT / "public" / "data" / "paper_s1.json",
    ROOT / "public" / "data" / "paper_s2.json",
]


def _read_csv(path: Path) -> list[dict]:
    with path.open() as fh:
        return list(csv.DictReader(fh))


def _f(value: str | float | None) -> float | None:
    if value is None or value == "" or value == "nan":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_table2_signatures() -> dict:
    rows = _read_csv(TABLES / "table2_agent_patterns.csv")
    out = {}
    for r in rows:
        agent = r["agent"]
        out[agent] = {
            "entropy": _f(r["entropy"]),
            "unique_techniques": _f(r["unique_session"]),
            "selection_cr1": _f(r["cr1"]),
            "session_asr_mean": _f(r["session_asr"]),
            "n_sessions": int(r["n"]),
            "top_family": r["top_family"],
            "top_sel_pct": _f(r["top_sel_pct"]),
            # backwards-compatible alias used by leaderboard-table.tsx
            "top_share": _f(r["top_sel_pct"]),
        }
    return out


def build_pooled_profiles(obs: pd.DataFrame, obs_long: pd.DataFrame) -> tuple[dict, dict]:
    pooled = pooled_observation_profiles(obs, obs_long)
    sel = {agent: {family: 0.0 for family in FAMILIES} for agent in AGENTS}
    asr = {agent: {family: 0.0 for family in FAMILIES} for agent in AGENTS}
    for row in pooled.itertuples(index=False):
        sel[row.agent][row.attack_family] = float(row.sel_pct) / 100.0
        asr_value = row.asr
        asr[row.agent][row.attack_family] = float(asr_value) if pd.notna(asr_value) else 0.0
    return sel, asr


def build_heatmap_by_condition(obs: pd.DataFrame, obs_long: pd.DataFrame) -> dict:
    cond = condition_profiles(obs, obs_long)
    out = {c: {agent: {family: 0.0 for family in FAMILIES} for agent in AGENTS} for c in CONDITIONS}
    for row in cond.itertuples(index=False):
        out[row.condition][row.agent][row.attack_family] = float(row.sel_pct)
    return out


def build_pooled_heatmap(sel: dict) -> dict:
    return {
        agent: {family: sel[agent][family] * 100.0 for family in FAMILIES}
        for agent in AGENTS
    }


def build_entropy_asr_correlation() -> dict:
    rows = _read_csv(TABLES / "entropy_asr_correlation.csv")
    return {
        r["agent"]: {"rho": _f(r["rho"]), "p": _f(r["p"]), "n": int(r["n"])}
        for r in rows
    }


def build_compliance_table() -> dict:
    rows = _read_csv(TABLES / "appendix_compliance_summary.csv")
    return {
        r["agent"]: {
            "obs_asr": _f(r["obs_asr"]),
            "inj_asr": _f(r["inj_asr"]),
            "delta_asr": _f(r["delta_asr"]),
            "compliance_mean": _f(r["compliance"]),
            "sessions": int(r["sessions"]),
        }
        for r in rows
    }


def build_decoupling_summary() -> list[dict]:
    rows = _read_csv(TABLES / "appendix_decoupling_summary.csv")
    return [
        {
            "agent": r["agent"],
            "top_family": r["top_family"],
            "top_sel_pct": _f(r["top_sel_pct"]),
            "top_asr_pct": _f(r["top_asr_pct"]),
            "tps": _f(r["tps"]),
        }
        for r in rows
    ]


def build_tps_summary() -> tuple[dict, list[dict]]:
    rows = _read_csv(TABLES / "appendix_tps_full.csv")
    per_agent = {r["agent"]: _f(r["s1_tps"]) for r in rows}
    full = [
        {
            "agent": r["agent"],
            "obs_tps": _f(r["s1_tps"]),
            "inj_tps": _f(r["s2_tps"]),
            "delta_pct": _f(r["delta_pct"]),
        }
        for r in rows
    ]
    return per_agent, full


def build_prompt_stability() -> dict:
    per_agent_rows = _read_csv(TABLES / "appendix_prompt_stability_jsd.csv")
    target_rows = _read_csv(TABLES / "appendix_target_jsd.csv")
    between_rows = _read_csv(TABLES / "appendix_between_agent_jsd.csv")
    per_agent_map = {
        r["agent"]: {
            "centroid_mean": _f(r["mean_jsd"]),
            "centroid_max": _f(r["max_jsd"]),
        }
        for r in per_agent_rows
    }
    centroid_means = [v["centroid_mean"] for v in per_agent_map.values() if v["centroid_mean"] is not None]
    centroid_within_mean = float(np.mean(centroid_means)) if centroid_means else 0.0
    between_jsd_values = [_f(r["jsd"]) for r in between_rows if _f(r["jsd"]) is not None]
    between_mean = float(np.mean(between_jsd_values)) if between_jsd_values else 0.0
    between_median = float(np.median(between_jsd_values)) if between_jsd_values else 0.0
    target_breakdown = [
        {
            "target": r["target"],
            "within_prompt": _f(r["within_prompt"]),
            "between_agent": _f(r["between_agent"]),
            "ratio": _f(r["ratio"]),
        }
        for r in target_rows
    ]
    return {
        "per_agent": per_agent_map,
        "centroid_within_mean": centroid_within_mean,
        "between_agent_mean": between_mean,
        "between_agent_median": between_median,
        "between_agent_n": len(between_jsd_values),
        "within_agent_n": len(per_agent_map),
        "target_breakdown": target_breakdown,
        # Main-text headline values from paper Section 4.
        "main_2axis_marginal_mean": 0.0379,
        "between_agent_pattern_mean": 0.0543,
    }


def build_agent_identification() -> dict:
    importance_rows = _read_csv(TABLES / "appendix_agent_identification_rf_importance.csv")
    metric_rows = _read_csv(TABLES / "appendix_agent_identification_rf_metrics.csv")
    per_agent_rows = _read_csv(TABLES / "appendix_agent_identification_rf.csv")
    metrics = {r["cv"]: {"accuracy": _f(r["accuracy"]), "macro_f1": _f(r["macro_f1"]), "n": int(r["n"])} for r in metric_rows}
    per_agent = [
        {
            "agent": r["agent"],
            "precision": _f(r["precision"]),
            "recall": _f(r["recall"]),
            "f1": _f(r["f1"]),
            "support": int(r["support"]),
        }
        for r in per_agent_rows
    ]
    importance = [
        {"feature": r.get("feature"), "importance": _f(r.get("importance"))}
        for r in importance_rows
    ]
    return {
        "metrics": metrics,
        "per_agent": per_agent,
        "feature_importance": importance,
        "baseline_accuracy": 0.20,
    }


def build_temporal_adaptation() -> list[dict]:
    rows = _read_csv(TABLES / "appendix_temporal_adaptation.csv")
    return [
        {
            "agent": r["agent"],
            "switch_after_failure": _f(r["switch_after_failure"]),
            "switch_after_success": _f(r["switch_after_success"]),
            "failure_success_switch_ratio": _f(r["failure_success_switch_ratio"]),
            "retry_same_endpoint": _f(r["retry_same_endpoint"]),
            "same_family_new_endpoint": _f(r["same_family_new_endpoint"]),
            "switch_family_same_endpoint": _f(r["switch_family_same_endpoint"]),
            "switch_family_new_endpoint": _f(r["switch_family_new_endpoint"]),
            "repeated_failure_share": _f(r["repeated_failure_share"]),
        }
        for r in rows
    ]


def build_injection_correlations() -> dict:
    rows = _read_csv(TABLES / "appendix_injection_correlations.csv")
    out = {}
    label_map = {
        "Sel -> compliance": "compliance_sel",
        "ASR_i -> compliance": "compliance_asri",
        "ASR_i -> target ASR": "asr_transfer",
        "Compliance -> session ASR": "compliance_session_asr",
    }
    for r in rows:
        key = label_map.get(r["relationship"])
        if not key:
            continue
        out[key] = {"rho": _f(r["rho"]), "p": _f(r["p"]), "n": int(r["n"])}
    return out


def build_compliance_predictors(
    obs: pd.DataFrame, obs_long: pd.DataFrame, inj: pd.DataFrame
) -> list[dict]:
    pooled = pooled_observation_profiles(obs, obs_long)
    inj_cells = injection_cells(inj)
    pooled_lookup = {
        (row.agent, row.attack_family): (
            float(row.sel_pct) / 100.0,
            float(row.asr) if pd.notna(row.asr) else None,
        )
        for row in pooled.itertuples(index=False)
    }
    out = []
    for row in inj_cells.itertuples(index=False):
        sel_i, asr_i = pooled_lookup.get((row.agent, row.attack_family), (None, None))
        out.append(
            {
                "agent": row.agent,
                "family": row.attack_family,
                "sel_i": sel_i,
                "asr_i": asr_i,
                "asr_i_s2": float(row.target_asr) if pd.notna(row.target_asr) else None,
                "compliance": float(row.compliance) if pd.notna(row.compliance) else None,
            }
        )
    return out


def build_entropy_asr_scatter(obs: pd.DataFrame, obs_long: pd.DataFrame) -> list[dict]:
    sessions = session_main_metrics(obs, obs_long).set_index("record_id")
    obs_indexed = obs.set_index("record_id")
    out = []
    for record_id, row in obs_indexed.iterrows():
        s = sessions.loc[record_id]
        out.append(
            {
                "agent": row["agent"],
                "session_id": record_id,
                "condition": row["condition"],
                "victim": row["target"],
                "entropy": float(s["entropy_main10"]),
                "session_asr": float(row["session_asr"]),
            }
        )
    return out


def build_kruskal_block(obs: pd.DataFrame, obs_long: pd.DataFrame) -> dict:
    sessions = session_main_metrics(obs, obs_long)
    metric_groups = {}
    for label, column in [
        ("kruskal_H", "entropy_main10"),
        ("kruskal_unique_count", "unique_main10"),
        ("kruskal_selection_cr1", "top_share_main10"),
        ("kruskal_session_asr", "session_asr"),
    ]:
        groups = [
            sessions[sessions["agent"] == agent][column].astype(float).to_numpy()
            for agent in AGENTS
        ]
        H, p, eta2 = kruskal_eta2(groups)
        metric_groups[label] = {"H": H, "p": p, "eta2": eta2}
    return metric_groups


def write_summary() -> None:
    obs, obs_long, inj, _inj_long = load_public_release()
    sel_per_agent, asr_per_agent = build_pooled_profiles(obs, obs_long)

    table2 = build_table2_signatures()
    inj_corr = build_injection_correlations()
    kruskal = build_kruskal_block(obs, obs_long)
    compliance = build_compliance_table()
    tps_per_agent, tps_full = build_tps_summary()

    headline_stats = {
        **kruskal,
        # Backward-compat alias for components reading kruskal_top_share.
        "kruskal_top_share": kruskal["kruskal_selection_cr1"],
        "asr_transfer": inj_corr["asr_transfer"],
        "compliance_sel": inj_corr["compliance_sel"],
        "compliance_asri": inj_corr["compliance_asri"],
        "compliance_session_asr": inj_corr["compliance_session_asr"],
        "all_negative_delta_asr": all(
            (row["delta_asr"] or 0.0) <= 0.0 for row in compliance.values()
        ),
        "rf_accuracy": 0.65,
        "rf_baseline": 0.20,
        "prompt_stability_jsd_main": 0.0379,
        "between_agent_jsd_main": 0.0543,
    }

    summary = {
        "agents": list(AGENTS),
        "agent_labels": dict(AGENT_LABEL),
        "families": list(FAMILIES),
        "n_sessions": {"s1": int(len(obs)), "s2": int(len(inj))},
        "table1_agent_signatures": table2,
        "table2_jsd": build_prompt_stability(),
        "table3_entropy_asr_rho": build_entropy_asr_correlation(),
        "table4_compliance": compliance,
        "fig2_selection_heatmap": build_pooled_heatmap(sel_per_agent),
        "fig2_selection_heatmap_by_condition": build_heatmap_by_condition(obs, obs_long),
        "fig3_selection_per_agent": sel_per_agent,
        "fig3_asri_per_agent": asr_per_agent,
        "fig4_entropy_asr_scatter": build_entropy_asr_scatter(obs, obs_long),
        "fig5_compliance_predictors": build_compliance_predictors(obs, obs_long, inj),
        "headline_stats": headline_stats,
        "tps_per_agent": tps_per_agent,
        "tps_full": tps_full,
        "decoupling_summary": build_decoupling_summary(),
        "agent_identification_rf": build_agent_identification(),
        "temporal_adaptation": build_temporal_adaptation(),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(summary, indent=2))
    for path in LEGACY_PURGE:
        if path.exists():
            path.unlink()
    print(f"wrote {OUTPUT.relative_to(ROOT)}  ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    write_summary()
