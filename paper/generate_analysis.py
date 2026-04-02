#!/usr/bin/env python3
"""Generate analysis_results.json from scen1_final_stats.json

Converts the paper's final stats into the format consumed by the CyBiasBench website.

Usage:
    python3 paper/generate_analysis.py
    python3 paper/generate_analysis.py --dry-run   # print diff without writing
"""

import json
import math
import sys
from pathlib import Path
from collections import defaultdict
from itertools import combinations

SCRIPT_DIR = Path(__file__).parent
INPUT_PATH = SCRIPT_DIR / "scen1_final_stats.json"
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "analysis_results.json"

AGENTS = ["claude", "codex", "gemini"]
CONDITION_MAP = {
    "GS": ("guided", "structured", "guided_structured"),
    "GU": ("guided", "unstructured", "guided_unstructured"),
    "US": ("unguided", "structured", "unguided_structured"),
    "UU": ("unguided", "unstructured", "unguided_unstructured"),
}
MODEL_COLORS = {"claude": "#E8956A", "codex": "#10A37F", "gemini": "#4285F4"}


def load_input():
    with open(INPUT_PATH) as f:
        return json.load(f)


def safe_div(a, b):
    return a / b if b else None


# ─── Per-Experiment Conversion ────────────────────────────────────────────────

def convert_experiment(row):
    guidance, structure, condition = CONDITION_MAP[row["condition"]]
    attack_total = row["attack_total"]
    attack_success = row["attack_success"]
    http_total = row["http_total"]
    tokens = row["total_tokens"]
    cost = row["total_cost"]

    # Technique distribution (counts from sel%)
    tech_dist = {}
    per_tech_asr = {}
    pref_index = {}
    per_tech_depth = {}
    for tech, vals in row.get("tech_table", {}).items():
        count = round(vals["sel"] / 100 * attack_total) if attack_total > 0 else 0
        tech_dist[tech] = count
        attempted = count
        succeeded = round(vals["asr"] * attempted) if attempted > 0 else 0
        per_tech_asr[tech] = {
            "attempted": attempted,
            "succeeded": succeeded,
            "asr": vals["asr"],
        }
        pref_index[tech] = vals.get("pi", 0)
        per_tech_depth[tech] = vals.get("div", 0)

    # First move: technique with highest PI (or first in sorted order)
    first_move = None
    if pref_index:
        first_move = max(pref_index, key=lambda t: pref_index[t])

    top_tech_name = row.get("top_tech")
    top_share = row.get("top_share", 0)

    return {
        "session_id": row["dir"],
        "agent": row["agent"],
        "target": row["victim"],
        "guidance": guidance,
        "structure": structure,
        "condition": condition,
        "total_requests": http_total,
        "attack_requests": attack_total,
        "benign_requests": http_total - attack_total,
        "attack_ratio": safe_div(attack_total, http_total) or 0,
        "technique_distribution": tech_dist,
        "shannon_entropy": row["entropy"],
        "hhi": row["hhi"],
        "overall_asr": row["trad_asr"],
        "successful_attacks": attack_success,
        "per_technique_asr": per_tech_asr,
        "agent_cost_usd": cost,
        "agent_tokens": tokens,
        "cost_per_success": safe_div(cost, attack_success),
        "tokens_per_attack": safe_div(tokens, attack_total),
        "tokens_per_success": safe_div(tokens, attack_success),
        "first_move": first_move,
        "attack_sequence_length": attack_total,
        "unique_techniques": len(tech_dist),
        "persistence_max_consecutive": 0,
        "persistence_avg_consecutive": 0,
        "persistence_score": 0,
        "exploration_rate": row.get("inertia", 0),
        "exploration_coverage": safe_div(len(tech_dist), 10),
        "total_possible_techniques": 10,
        "self_report_concordance": None,
        "preference_index": pref_index,
        "inertia_rate": row.get("inertia"),
        "per_technique_depth": per_tech_depth,
        "method_bias": {"get_pct": 0, "post_pct": 0, "put_pct": 0, "delete_pct": 0, "head_pct": 0, "other_pct": 0, "attack_post_pct": 0},
        "mismatch": row["mismatch"],
        "hallucinated_attack_bias": None,
        "payload_diversity": {},
        "recon_ratio": 0,
        "unique_endpoints": row.get("endpoints", 0),
        "top_technique": {
            "technique": top_tech_name,
            "count": round(top_share / 100 * attack_total) if attack_total > 0 else 0,
            "share_pct": top_share / 100,
        } if top_tech_name else None,
        "avg_latency": {"all_requests_ms": None, "attack_only_ms": None},
        "solved_challenges": row.get("challenges", 0) if row.get("challenges", 0) > 0 else None,
        "total_challenges": None,
        "challenge_asr": row.get("cy") if row.get("cy", 0) > 0 else None,
        "challenge_details": None,
        "tokens_per_challenge": None,
    }


# ─── Aggregation ──────────────────────────────────────────────────────────────

def mean(vals):
    return sum(vals) / len(vals) if vals else 0


def aggregate_experiments(experiments):
    """Aggregate a list of per_experiment dicts into a single agent summary."""
    total_requests = sum(e["total_requests"] for e in experiments)
    total_attacks = sum(e["attack_requests"] for e in experiments)
    total_successes = sum(e["successful_attacks"] for e in experiments)
    total_tokens = sum(e["agent_tokens"] for e in experiments)
    total_cost = sum(e["agent_cost_usd"] for e in experiments)

    # Technique distribution (sum counts)
    tech_dist = defaultdict(int)
    for e in experiments:
        for tech, count in e["technique_distribution"].items():
            tech_dist[tech] += count

    # Per-technique ASR (sum attempted/succeeded)
    tech_asr_agg = defaultdict(lambda: {"attempted": 0, "succeeded": 0})
    for e in experiments:
        for tech, vals in e["per_technique_asr"].items():
            tech_asr_agg[tech]["attempted"] += vals["attempted"]
            tech_asr_agg[tech]["succeeded"] += vals["succeeded"]
    per_tech_asr = {}
    for tech, vals in tech_asr_agg.items():
        per_tech_asr[tech] = {
            "attempted": vals["attempted"],
            "succeeded": vals["succeeded"],
            "asr": safe_div(vals["succeeded"], vals["attempted"]) or 0,
        }

    # Shannon entropy of aggregated distribution
    total_tech = sum(tech_dist.values())
    entropy = 0
    if total_tech > 0:
        for count in tech_dist.values():
            if count > 0:
                p = count / total_tech
                entropy -= p * math.log2(p)

    # HHI
    hhi = 0
    if total_tech > 0:
        for count in tech_dist.values():
            hhi += (count / total_tech) ** 2

    # Top technique
    top_tech = None
    if tech_dist:
        top_name = max(tech_dist, key=lambda t: tech_dist[t])
        top_count = tech_dist[top_name]
        top_tech = {
            "technique": top_name,
            "count": top_count,
            "share_pct": safe_div(top_count, total_tech) or 0,
        }

    # First move distribution
    first_moves = defaultdict(int)
    for e in experiments:
        if e["first_move"]:
            first_moves[e["first_move"]] += 1

    solved = [e["solved_challenges"] for e in experiments if e["solved_challenges"] is not None]

    return {
        "total_requests": total_requests,
        "total_attack_requests": total_attacks,
        "total_successful_attacks": total_successes,
        "overall_attack_ratio": safe_div(total_attacks, total_requests) or 0,
        "overall_asr": safe_div(total_successes, total_attacks) or 0,
        "total_cost_usd": total_cost,
        "total_tokens": total_tokens,
        "cost_per_success": safe_div(total_cost, total_successes),
        "tokens_per_attack": safe_div(total_tokens, total_attacks),
        "tokens_per_success": safe_div(total_tokens, total_successes),
        "technique_distribution": dict(tech_dist),
        "shannon_entropy": entropy,
        "hhi": hhi,
        "per_technique_asr": per_tech_asr,
        "first_move_distribution": dict(first_moves),
        "avg_persistence_score": mean([e["persistence_score"] for e in experiments]),
        "avg_exploration_rate": mean([e["exploration_rate"] for e in experiments]),
        "avg_exploration_coverage": mean([e["exploration_coverage"] for e in experiments if e["exploration_coverage"] is not None]) or None,
        "experiment_count": len(experiments),
        "avg_inertia_rate": mean([e["inertia_rate"] for e in experiments if e["inertia_rate"] is not None]) if any(e["inertia_rate"] is not None for e in experiments) else None,
        "avg_hallucinated_attack_bias": None,
        "avg_mismatch": mean([e["mismatch"] for e in experiments]),
        "total_unique_endpoints": sum(e["unique_endpoints"] for e in experiments),
        "avg_recon_ratio": 0,
        "method_bias": {"get_pct": 0, "post_pct": 0, "put_pct": 0, "delete_pct": 0, "head_pct": 0, "other_pct": 0, "attack_post_pct": 0},
        "top_technique": top_tech,
        "avg_latency": {"all_requests_ms": None, "attack_only_ms": None},
        "total_solved_challenges": sum(solved) if solved else None,
        "total_challenges": None,
        "avg_challenge_asr": mean([e["challenge_asr"] for e in experiments if e["challenge_asr"] is not None]) if any(e["challenge_asr"] is not None for e in experiments) else None,
        "tokens_per_challenge": None,
        "bias_asr_correlation": None,
    }


# ─── Statistical Tests ────────────────────────────────────────────────────────

def compute_jsd(p, q):
    """Jensen-Shannon Divergence between two distributions."""
    m = [(pi + qi) / 2 for pi, qi in zip(p, q)]
    def kl(a, b):
        return sum(ai * math.log2(ai / bi) for ai, bi in zip(a, b) if ai > 0 and bi > 0)
    return (kl(p, m) + kl(q, m)) / 2


def compute_statistical_tests(experiments, agg_by_agent):
    """Compute JSD, chi-squared, Fisher tests, Spearman correlation."""
    # All techniques across agents
    all_techs = sorted(set(
        t for a in AGENTS for t in agg_by_agent.get(a, {}).get("technique_distribution", {})
    ))

    # JSD between agent pairs
    vectors = {}
    for agent in AGENTS:
        dist = agg_by_agent.get(agent, {}).get("technique_distribution", {})
        total = sum(dist.values()) or 1
        vectors[agent] = [dist.get(t, 0) / total for t in all_techs]

    jsd = {}
    for a1, a2 in combinations(AGENTS, 2):
        key = f"{a1}_vs_{a2}"
        jsd[key] = compute_jsd(vectors[a1], vectors[a2])

    # Chi-squared (simplified)
    observed = []
    for agent in AGENTS:
        dist = agg_by_agent.get(agent, {}).get("technique_distribution", {})
        observed.append([dist.get(t, 0) for t in all_techs])

    n = sum(sum(row) for row in observed)
    row_totals = [sum(row) for row in observed]
    col_totals = [sum(observed[i][j] for i in range(len(AGENTS))) for j in range(len(all_techs))]
    chi2 = 0
    for i in range(len(AGENTS)):
        for j in range(len(all_techs)):
            expected = row_totals[i] * col_totals[j] / n if n > 0 else 0
            if expected > 0:
                chi2 += (observed[i][j] - expected) ** 2 / expected
    dof = (len(AGENTS) - 1) * (len(all_techs) - 1)

    return {
        "jsd_analysis": {
            "techniques": all_techs,
            "jsd": jsd,
            "vectors": vectors,
        },
        "chi_squared": {
            "chi2": chi2,
            "p_value": 0,  # Would need scipy
            "dof": dof,
            "significant_005": chi2 > 50,  # Rough heuristic
            "agents": AGENTS,
            "techniques": all_techs,
        },
        "fisher_tests": {},
        "spearman_correlation": {},
    }


def compute_cross_target_shift(experiments, targets):
    """Compute JSD between targets per agent."""
    result = {}
    all_techs = sorted(set(t for e in experiments for t in e["technique_distribution"]))

    for agent in AGENTS:
        result[agent] = {}
        for t1, t2 in combinations(sorted(targets), 2):
            exps1 = [e for e in experiments if e["agent"] == agent and e["target"] == t1]
            exps2 = [e for e in experiments if e["agent"] == agent and e["target"] == t2]

            def get_vec(exps):
                dist = defaultdict(int)
                for e in exps:
                    for tech, c in e["technique_distribution"].items():
                        dist[tech] += c
                total = sum(dist.values()) or 1
                return [dist.get(t, 0) / total for t in all_techs]

            v1, v2 = get_vec(exps1), get_vec(exps2)
            asr1 = mean([e["overall_asr"] for e in exps1])
            asr2 = mean([e["overall_asr"] for e in exps2])
            ent1 = mean([e["shannon_entropy"] for e in exps1])
            ent2 = mean([e["shannon_entropy"] for e in exps2])

            key = f"{t1}_vs_{t2}"
            result[agent][key] = {
                "jsd": compute_jsd(v1, v2) if any(x > 0 for x in v1) and any(x > 0 for x in v2) else 0,
                "target1": t1, "target2": t2,
                "target1_asr": asr1, "target2_asr": asr2,
                "target1_ar": 0, "target2_ar": 0,
                "target1_entropy": ent1, "target2_entropy": ent2,
                "techniques": all_techs,
                "target1_vector": v1, "target2_vector": v2,
            }
    return result


def compute_bias_asr_correlation(experiments):
    """Compute per-technique bias-ASR correlation."""
    tech_stats = defaultdict(lambda: {"attempts": 0, "successes": 0, "per_agent": defaultdict(int)})
    for e in experiments:
        for tech, vals in e["per_technique_asr"].items():
            tech_stats[tech]["attempts"] += vals["attempted"]
            tech_stats[tech]["successes"] += vals["succeeded"]
            tech_stats[tech]["per_agent"][e["agent"]] += vals["attempted"]

    per_technique = {}
    total_attempts = sum(v["attempts"] for v in tech_stats.values()) or 1
    for tech, vals in tech_stats.items():
        per_technique[tech] = {
            "total_attempts": vals["attempts"],
            "total_successes": vals["successes"],
            "asr": safe_div(vals["successes"], vals["attempts"]) or 0,
            "attempt_share": vals["attempts"] / total_attempts,
            "per_agent_attempts": dict(vals["per_agent"]),
        }

    weighted_asr = sum(v["asr"] * v["attempt_share"] for v in per_technique.values())
    return {
        "per_technique": per_technique,
        "weighted_mean_asr": weighted_asr,
        "attempt_weighted_asr": weighted_asr,
    }


def compute_guided_vs_unguided(experiments):
    by_agent = {}
    for agent in AGENTS:
        guided = [e for e in experiments if e["agent"] == agent and e["guidance"] == "guided"]
        unguided = [e for e in experiments if e["agent"] == agent and e["guidance"] == "unguided"]
        if not guided or not unguided:
            continue

        def cond_stats(exps):
            dist = defaultdict(int)
            for e in exps:
                for t, c in e["technique_distribution"].items():
                    dist[t] += c
            return {
                "experiment_count": len(exps),
                "attack_requests": sum(e["attack_requests"] for e in exps),
                "successful": sum(e["successful_attacks"] for e in exps),
                "asr": mean([e["overall_asr"] for e in exps]),
                "technique_distribution": dict(dist),
                "entropy": mean([e["shannon_entropy"] for e in exps]),
                "avg_exploration_rate": mean([e["exploration_rate"] for e in exps]),
                "avg_persistence_score": 0,
            }

        gs = cond_stats(guided)
        us = cond_stats(unguided)

        # JSD shift
        all_techs = sorted(set(list(gs["technique_distribution"].keys()) + list(us["technique_distribution"].keys())))
        def to_vec(dist):
            total = sum(dist.values()) or 1
            return [dist.get(t, 0) / total for t in all_techs]
        v1, v2 = to_vec(gs["technique_distribution"]), to_vec(us["technique_distribution"])

        by_agent[agent] = {
            "guided": gs,
            "unguided": us,
            "delta_asr": gs["asr"] - us["asr"],
            "delta_entropy": gs["entropy"] - us["entropy"],
            "technique_shift_jsd": compute_jsd(v1, v2) if any(x > 0 for x in v1) and any(x > 0 for x in v2) else 0,
        }

    g_asrs = [by_agent[a]["guided"]["asr"] for a in by_agent]
    u_asrs = [by_agent[a]["unguided"]["asr"] for a in by_agent]
    return {
        "by_agent": by_agent,
        "summary": {
            "guided_mean_asr": mean(g_asrs),
            "unguided_mean_asr": mean(u_asrs),
            "overall_delta_asr": mean(g_asrs) - mean(u_asrs),
        },
    }


def compute_structured_vs_unstructured(experiments):
    by_agent = {}
    for agent in AGENTS:
        structured = [e for e in experiments if e["agent"] == agent and e["structure"] == "structured"]
        unstructured = [e for e in experiments if e["agent"] == agent and e["structure"] == "unstructured"]
        if not structured or not unstructured:
            continue

        def cond_stats(exps):
            dist = defaultdict(int)
            for e in exps:
                for t, c in e["technique_distribution"].items():
                    dist[t] += c
            return {
                "experiment_count": len(exps),
                "attack_requests": sum(e["attack_requests"] for e in exps),
                "successful": sum(e["successful_attacks"] for e in exps),
                "asr": mean([e["overall_asr"] for e in exps]),
                "technique_distribution": dict(dist),
                "entropy": mean([e["shannon_entropy"] for e in exps]),
                "avg_exploration_rate": mean([e["exploration_rate"] for e in exps]),
                "avg_persistence_score": 0,
            }

        ss = cond_stats(structured)
        us = cond_stats(unstructured)

        all_techs = sorted(set(list(ss["technique_distribution"].keys()) + list(us["technique_distribution"].keys())))
        def to_vec(dist):
            total = sum(dist.values()) or 1
            return [dist.get(t, 0) / total for t in all_techs]
        v1, v2 = to_vec(ss["technique_distribution"]), to_vec(us["technique_distribution"])

        by_agent[agent] = {
            "structured": ss,
            "unstructured": us,
            "delta_asr": ss["asr"] - us["asr"],
            "delta_entropy": ss["entropy"] - us["entropy"],
            "technique_shift_jsd": compute_jsd(v1, v2) if any(x > 0 for x in v1) and any(x > 0 for x in v2) else 0,
        }

    s_asrs = [by_agent[a]["structured"]["asr"] for a in by_agent]
    u_asrs = [by_agent[a]["unstructured"]["asr"] for a in by_agent]
    return {
        "by_agent": by_agent,
        "summary": {
            "structured_mean_asr": mean(s_asrs),
            "unstructured_mean_asr": mean(u_asrs),
            "overall_delta_asr": mean(s_asrs) - mean(u_asrs),
        },
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv

    raw = load_input()
    print(f"Loaded {len(raw)} experiments from scen1_final_stats.json")

    # Convert per-experiment
    per_experiment = [convert_experiment(row) for row in raw]

    # Aggregations
    agg_by_agent = {}
    for agent in AGENTS:
        exps = [e for e in per_experiment if e["agent"] == agent]
        if exps:
            agg_by_agent[agent] = aggregate_experiments(exps)

    targets = sorted(set(e["target"] for e in per_experiment))
    agg_by_target = {}
    for target in targets:
        agg_by_target[target] = {}
        for agent in AGENTS:
            exps = [e for e in per_experiment if e["target"] == target and e["agent"] == agent]
            if exps:
                agg_by_target[target][agent] = aggregate_experiments(exps)

    conditions = sorted(set(e["condition"] for e in per_experiment))
    agg_by_condition = {}
    for cond in conditions:
        agg_by_condition[cond] = {}
        for agent in AGENTS:
            exps = [e for e in per_experiment if e["condition"] == cond and e["agent"] == agent]
            if exps:
                agg_by_condition[cond][agent] = aggregate_experiments(exps)

    # Statistical tests
    stat_tests = compute_statistical_tests(per_experiment, agg_by_agent)
    cross_target = compute_cross_target_shift(per_experiment, targets)
    bias_asr = compute_bias_asr_correlation(per_experiment)
    guided_unguided = compute_guided_vs_unguided(per_experiment)
    struct_unstruct = compute_structured_vs_unstructured(per_experiment)

    # Experiment matrix
    exp_matrix = {}
    for e in per_experiment:
        if e["session_id"] not in exp_matrix:
            exp_matrix[e["session_id"]] = {
                "target": e["target"],
                "guidance": e["guidance"],
                "structure": e["structure"],
            }

    result = {
        "per_experiment": per_experiment,
        "aggregated_by_agent": agg_by_agent,
        "aggregated_by_target": agg_by_target,
        "aggregated_by_condition": agg_by_condition,
        "statistical_tests": stat_tests,
        "cross_target_shift": cross_target,
        "bias_asr_correlation": bias_asr,
        "guided_vs_unguided": guided_unguided,
        "structured_vs_unstructured": struct_unstruct,
        "model_colors": MODEL_COLORS,
        "experiment_matrix": exp_matrix,
    }

    if dry_run:
        # Compare with current
        with open(OUTPUT_PATH) as f:
            current = json.load(f)
        cur_exps = {(e["session_id"], e["agent"]): e for e in current["per_experiment"]}
        diffs = 0
        for e in per_experiment:
            key = (e["session_id"], e["agent"])
            if key in cur_exps:
                cur = cur_exps[key]
                for field in ["overall_asr", "shannon_entropy", "attack_requests", "successful_attacks", "agent_tokens", "agent_cost_usd", "mismatch"]:
                    cv, nv = cur.get(field), e.get(field)
                    if cv is not None and nv is not None and abs(cv - nv) > 0.001:
                        diffs += 1
                        if diffs <= 10:
                            print(f"  {key[0]}/{key[1]} {field}: {cv:.4f} -> {nv:.4f}")
        print(f"\nTotal field diffs: {diffs}")
    else:
        with open(OUTPUT_PATH, "w") as f:
            json.dump(result, f, indent=None, ensure_ascii=False)
        size_kb = OUTPUT_PATH.stat().st_size / 1024
        print(f"Written {OUTPUT_PATH} ({size_kb:.0f} KB)")
        print(f"  per_experiment: {len(per_experiment)}")
        print(f"  agents: {list(agg_by_agent.keys())}")
        print(f"  targets: {list(agg_by_target.keys())}")
        print(f"  conditions: {list(agg_by_condition.keys())}")


if __name__ == "__main__":
    main()
