#!/usr/bin/env python3
"""Rebuild every dashboard metric from the public CSVs, with no prior JSON input.

Run from any directory. --summary selects the output; --check recomputes all
metrics and compares with that file without changing it. No private paper files,
precomputed analysis results, network access, or model calls are needed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from itertools import combinations
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from agent_identification import reproduce as identify_agents
from momentum_repro import reproduce as reproduce_momentum
from reviewer_revisions import bootstrap, session_asr
from temporal_repro import reproduce as reproduce_temporal
from summary_metrics import (AGENTS, CONDITIONS, FAMILIES, condition_profiles,
                             js_divergence, kruskal_eta2, observation_family_counts,
                             pooled_observation_profiles, session_main_metrics)

LABELS = dict(zip(AGENTS, ["Claude", "Codex", "Gemini", "GLM", "Kimi"]))
INPUTS = ["bias_observation_records.csv", "bias_observation_family_long.csv",
          "bias_injection_records.csv", "bias_observation_traces.csv",
          "bias_injection_traces.csv"]
DRAWS, SEED = 20000, 20260725


def correlations(x, y):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    mask = np.isfinite(x) & np.isfinite(y)
    rho, p = spearmanr(x[mask], y[mask])
    return {"rho": float(rho), "p": float(p), "n": int(mask.sum())}


def prompt_stability(counts):
    def profile(agent, conditions=CONDITIONS, target=None):
        sub = counts[(counts.agent == agent) & counts.condition.isin(conditions)]
        if target is not None:
            sub = sub[sub.target == target]
        return sub.groupby("attack_family").attempts.sum().reindex(FAMILIES, fill_value=0).to_numpy()

    def normalize(v):
        return v / v.sum() if v.sum() else v

    def axes(agent, target=None):
        return [js_divergence(profile(agent, left, target), profile(agent, right, target))
                for left, right in [(["GU", "GS"], ["UU", "US"]),
                                    (["US", "GS"], ["UU", "GU"])]]

    # The archived centroid analysis (within and between agents) smooths
    # normalized vectors by 1e-12. Target-wise marginal axes use raw counts.
    per_agent = {}
    for agent in AGENTS:
        center = normalize(profile(agent))
        distances = [js_divergence(normalize(profile(agent, [c])) + 1e-12, center + 1e-12)
                     for c in CONDITIONS]
        per_agent[agent] = {"centroid_mean": float(np.mean(distances)),
                            "centroid_max": float(np.max(distances))}
    between = [js_divergence(normalize(profile(a)) + 1e-12, normalize(profile(b)) + 1e-12)
               for a, b in combinations(AGENTS, 2)]
    targets = []
    for target in sorted(counts.target.unique()):
        within = float(np.mean([v for a in AGENTS for v in axes(a, target)]))
        across = float(np.mean([js_divergence(profile(a, target=target), profile(b, target=target))
                                for a, b in combinations(AGENTS, 2)]))
        targets.append({"target": target, "within_prompt": within,
                        "between_agent": across, "ratio": across / within})
    return {
        "per_agent": per_agent,
        "centroid_within_mean": float(np.mean([r["centroid_mean"] for r in per_agent.values()])),
        "between_agent_mean": float(np.mean(between)),
        "between_agent_median": float(np.median(between)),
        "between_agent_n": len(between), "within_agent_n": len(AGENTS),
        "target_breakdown": targets,
        # Preserve the paper's displayed precision, but calculate the values.
        "main_2axis_marginal_mean": round(float(np.mean([v for a in AGENTS for v in axes(a)])), 4),
        "between_agent_pattern_mean": round(float(np.mean(between)), 4),
    }


def observation_summary(obs, family):
    sessions = session_main_metrics(obs, family)
    pooled = pooled_observation_profiles(obs, family)
    conditional = condition_profiles(obs, family)
    selection, asr = {}, {}
    for agent in AGENTS:
        sub = pooled[pooled.agent == agent].set_index("attack_family")
        selection[agent] = {f: float(sub.loc[f, "sel_pct"]) / 100.0 for f in FAMILIES}
        asr[agent] = {f: float(sub.loc[f, "asr"]) if pd.notna(sub.loc[f, "asr"]) else 0.0
                      for f in FAMILIES}
    signatures, entropy_corr = {}, {}
    for agent in AGENTS:
        sub = sessions[sessions.agent == agent]
        top = max(selection[agent], key=selection[agent].get)
        top_pct = selection[agent][top] * 100.0
        signatures[agent] = {
            "entropy": float(sub.entropy_main10.mean()),
            "unique_techniques": float(sub.unique_main10.mean()),
            "selection_cr1": float(sub.top_share_main10.mean()),
            "session_asr_mean": float(sub.session_asr.mean()), "n_sessions": len(sub),
            "top_family": top, "top_sel_pct": top_pct, "top_share": top_pct,
        }
        entropy_corr[agent] = correlations(sub.entropy_main10, sub.session_asr)
    heatmap = {c: {a: {} for a in AGENTS} for c in CONDITIONS}
    for row in conditional.itertuples(index=False):
        heatmap[row.condition][row.agent][row.attack_family] = float(row.sel_pct)
    by_id = sessions.set_index("record_id")
    scatter = [{"agent": r.agent, "session_id": r.record_id, "condition": r.condition,
                "victim": r.target, "entropy": float(by_id.loc[r.record_id, "entropy_main10"]),
                "session_asr": float(r.session_asr)} for r in obs.itertuples(index=False)]
    kruskal = {}
    for label, column in [("kruskal_H", "entropy_main10"), ("kruskal_unique_count", "unique_main10"),
                           ("kruskal_selection_cr1", "top_share_main10"), ("kruskal_session_asr", "session_asr")]:
        h, p, eta = kruskal_eta2([sessions[sessions.agent == a][column].to_numpy() for a in AGENTS])
        kruskal[label] = {"H": h, "p": p, "eta2": eta}
    kruskal["kruskal_top_share"] = kruskal["kruskal_selection_cr1"]
    return {
        "table1_agent_signatures": signatures,
        "table2_jsd": prompt_stability(observation_family_counts(obs, family)),
        "table3_entropy_asr_rho": entropy_corr,
        "fig2_selection_heatmap": {a: {f: selection[a][f] * 100.0 for f in FAMILIES} for a in AGENTS},
        "fig2_selection_heatmap_by_condition": heatmap,
        "fig3_selection_per_agent": selection, "fig3_asri_per_agent": asr,
        "fig4_entropy_asr_scatter": scatter,
    }, pooled, kruskal


def injection_summary(inj, pooled):
    cells = inj.groupby(["agent", "requested_family"], as_index=False).agg(
        compliance=("compliance", "mean"), session_asr=("session_asr", "mean"),
        attempts=("requested_family_attempts", "sum"), successes=("requested_family_successes", "sum"))
    cells = cells.rename(columns={"requested_family": "attack_family"})
    cells["requested_asr"] = cells.successes / cells.attempts.replace(0, np.nan)
    cells = cells.merge(pooled[["agent", "attack_family", "sel_pct", "asr"]],
                        on=["agent", "attack_family"], validate="one_to_one")
    predictors = [{"agent": r.agent, "family": r.attack_family, "sel_i": float(r.sel_pct) / 100.0,
                   "asr_i": float(r.asr) if pd.notna(r.asr) else None,
                   "asr_i_s2": float(r.requested_asr) if pd.notna(r.requested_asr) else None,
                   "compliance": float(r.compliance)} for r in cells.itertuples(index=False)]
    # The published transfer correlation includes all 50 cells with undefined
    # family ASRs set to zero; the scatter preserves nulls for those cells.
    return predictors, {
        "asr_transfer": correlations(cells.asr.fillna(0.0), cells.requested_asr.fillna(0.0)),
        "compliance_session_asr": correlations(cells.compliance, cells.session_asr),
    }


def token_costs(obs, inj, signatures, asr):
    rows = []
    for agent in AGENTS:
        a, b = obs[obs.agent == agent], inj[inj.agent == agent]
        obs_tps = float(a.total_tokens.sum() / a.attack_success.sum())
        inj_tps = float(b.total_tokens.sum() / b.attack_success.sum())
        rows.append({"agent": agent, "obs_tps": obs_tps, "inj_tps": inj_tps,
                     "delta_pct": 100.0 * (inj_tps - obs_tps) / obs_tps})
    rows.sort(key=lambda r: r["obs_tps"])
    per_agent = {r["agent"]: r["obs_tps"] for r in rows}
    decoupling = [{"agent": a, "top_family": s["top_family"], "top_sel_pct": s["top_sel_pct"],
                   "top_asr_pct": asr[a][s["top_family"]] * 100.0, "tps": per_agent[a]}
                  for a, s in signatures.items()]
    decoupling.sort(key=lambda r: r["top_sel_pct"], reverse=True)
    return {"tps_per_agent": per_agent, "tps_full": rows, "decoupling_summary": decoupling}


def build_summary(data):
    hashes = {name: hashlib.sha256((data / name).read_bytes()).hexdigest() for name in INPUTS}
    obs, family, inj = [pd.read_csv(data / name) for name in INPUTS[:3]]
    if len(obs) != 180 or len(inj) != 450 or not obs.record_id.is_unique or not inj.record_id.is_unique:
        raise ValueError("Expected the released 180 observation and 450 injection sessions")
    for frame, n in [(obs, 36), (inj, 90)]:
        if set(frame.agent) != set(AGENTS) or not frame.groupby("agent").size().eq(n).all():
            raise ValueError("Unexpected agent/session counts")
    if not family.record_id.isin(obs.record_id).all():
        raise ValueError("Observation family row refers to an unknown session")
    print("Recomputing selection, diversity, JSD, correlations, and token costs...", flush=True)
    result, pooled, headline = observation_summary(obs, family)
    result["fig5_compliance_predictors"], injection_corr = injection_summary(inj, pooled)
    result.update(token_costs(obs, inj, result["table1_agent_signatures"], result["fig3_asri_per_agent"]))
    momentum, _ = reproduce_momentum(data)
    headline.update(injection_corr)
    headline["compliance_sel"] = momentum["compliance_selection"]["within_agent_standardized_pooled"]
    headline["compliance_asri"] = momentum["compliance_family_asr"]["within_agent_standardized_pooled"]
    headline["prompt_stability_jsd_main"] = result["table2_jsd"]["main_2axis_marginal_mean"]
    headline["between_agent_jsd_main"] = result["table2_jsd"]["between_agent_pattern_mean"]
    print("Checking trace-to-record counts and bootstrapping session ASR...", flush=True)
    _, obs_rates = session_asr(data, "observation")
    _, inj_rates = session_asr(data, "injection")
    estimates = bootstrap(obs_rates, inj_rates, DRAWS, SEED)
    compliance = inj.groupby("agent").compliance.mean()
    result["table4_compliance"] = {a: {
        "obs_asr": estimates[a]["observation"], "inj_asr": estimates[a]["injection"],
        "delta_asr": estimates[a]["delta"], "compliance_mean": float(compliance[a]),
        "sessions": estimates[a]["n_injection"]} for a in AGENTS}
    result["session_asr_uncertainty"] = {
        "estimates": estimates, "bootstrap_draws": DRAWS, "bootstrap_seed": SEED,
        "success_policy": "original released automatic labels; CSRF never credited",
        "input_sha256": {name: hashes[name] for name in sorted(hashes) if not name.endswith("family_long.csv")},
    }
    temporal, _ = reproduce_temporal(data)
    result["temporal_adaptation"] = temporal["per_agent"]
    print("Recomputing 500-tree agent identification (leave-one-out and five-fold)...", flush=True)
    identification, _ = identify_agents(data)
    result["agent_identification_rf"] = {k: identification[k] for k in
                                         ("metrics", "per_agent", "feature_importance", "baseline_accuracy")}
    headline["rf_accuracy"] = identification["metrics"]["leave_one_out"]["accuracy"]
    headline["rf_baseline"] = identification["baseline_accuracy"]
    result["headline_stats"] = headline
    if hashes != {name: hashlib.sha256((data / name).read_bytes()).hexdigest() for name in INPUTS}:
        raise ValueError("Input data changed during the build")
    return {"agents": AGENTS, "agent_labels": LABELS, "families": FAMILIES,
            "n_sessions": {"s1": len(obs), "s2": len(inj)}, **result,
            "reproduction": {"input_sha256": hashes, "human_audit_included": False,
                             "agent_identification": identification["metadata"],
                             "temporal": temporal["metadata"], "momentum": momentum["metadata"]}}


def differences(actual, expected, path="$"):
    """Report structural/value changes; tolerate only floating point roundoff."""
    if isinstance(actual, dict) and isinstance(expected, dict):
        for key in sorted(actual.keys() | expected.keys()):
            if key not in actual or key not in expected:
                yield f"{path}.{key}: missing key"
            else:
                yield from differences(actual[key], expected[key], f"{path}.{key}")
    elif isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected):
            yield f"{path}: length {len(actual)} != {len(expected)}"
        else:
            for i, (a, b) in enumerate(zip(actual, expected)):
                yield from differences(a, b, f"{path}[{i}]")
    elif isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        if not np.isclose(actual, expected, rtol=1e-12, atol=1e-12):
            yield f"{path}: {actual!r} != {expected!r}"
    elif actual != expected:
        yield f"{path}: {actual!r} != {expected!r}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--summary", type=Path, default=ROOT / "dashboard/public/data/paper_summary.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check and not args.summary.exists():
        raise SystemExit(f"Summary does not exist: {args.summary}; build it first")
    summary = build_summary(args.data_dir)
    encoded = json.dumps(summary, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.check:
        changes = list(differences(summary, json.loads(args.summary.read_text())))
        if changes:
            raise SystemExit("Dashboard summary differs from public-data reconstruction:\n" + "\n".join(changes[:20]))
        print("Every dashboard field matches the public-data reconstruction.")
    else:
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.summary.write_text(encoded)
        print(f"Rebuilt every dashboard field: {args.summary}")


if __name__ == "__main__":
    main()
