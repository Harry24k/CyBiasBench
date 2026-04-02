#!/usr/bin/env python3
"""Generate scenario2_results.json from scen2_final_stats.json

Usage:
    python3 paper/generate_s2_analysis.py
"""

import json
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).parent
S1_PATH = SCRIPT_DIR / "scen1_final_stats.json"
S2_PATH = SCRIPT_DIR / "scen2_final_stats.json"
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "scenario2_results.json"

AGENTS = ["claude", "codex", "gemini"]
TECHS = [
    "sqli", "xss", "cmdi", "auth_bypass", "idor",
    "path_traversal", "file_upload", "ssrf", "csrf", "info_disclosure",
]


def mean(vals):
    return sum(vals) / len(vals) if vals else 0


def safe_div(a, b):
    return a / b if b else None


def main():
    with open(S1_PATH) as f:
        s1 = json.load(f)
    with open(S2_PATH) as f:
        s2 = json.load(f)

    # ── S2 per-technique aggregation (all victims) ──

    s2_by_agent_tech = defaultdict(lambda: {
        "att": 0, "suc": 0, "target_att": 0, "target_suc": 0,
        "compliance_sum": 0, "n": 0, "tokens": 0, "cost": 0,
    })
    for e in s2:
        k = (e["agent"], e["target_tech"])
        d = s2_by_agent_tech[k]
        d["att"] += e["attack_total"]
        d["suc"] += e["attack_success"]
        d["target_att"] += e["target_att"]
        d["target_suc"] += e["target_succ"]
        d["compliance_sum"] += e["compliance"]
        d["n"] += 1
        d["tokens"] += e["total_tokens"]
        d["cost"] += e["total_cost"]

    # ── S1 per-technique for comparison ──

    s1_by_agent_tech = defaultdict(lambda: {"att": 0, "suc": 0})
    for e in s1:
        for tech, vals in e.get("tech_table", {}).items():
            att = round(vals["sel"] / 100 * e["attack_total"])
            suc = round(vals["asr"] * att)
            s1_by_agent_tech[(e["agent"], tech)]["att"] += att
            s1_by_agent_tech[(e["agent"], tech)]["suc"] += suc

    # ── Build output ──

    # Target ASR heatmap data (agent × technique)
    target_asr = {}
    for a in AGENTS:
        target_asr[a] = {}
        for t in TECHS:
            d = s2_by_agent_tech.get((a, t))
            if d and d["target_att"] > 0:
                target_asr[a][t] = round(d["target_suc"] / d["target_att"], 4)
            else:
                target_asr[a][t] = None

    # Compliance heatmap data (agent × technique)
    compliance = {}
    for a in AGENTS:
        compliance[a] = {}
        for t in TECHS:
            d = s2_by_agent_tech.get((a, t))
            if d and d["n"] > 0:
                compliance[a][t] = round(d["compliance_sum"] / d["n"], 4)
            else:
                compliance[a][t] = None

    # S1 vs S2 comparison
    s1_vs_s2 = {}
    for a in AGENTS:
        s1_vs_s2[a] = {}
        for t in TECHS:
            d1 = s1_by_agent_tech.get((a, t))
            d2 = s2_by_agent_tech.get((a, t))
            s1_asr = safe_div(d1["suc"], d1["att"]) if d1 and d1["att"] > 0 else None
            s2_asr = safe_div(d2["target_suc"], d2["target_att"]) if d2 and d2["target_att"] > 0 else None
            s1_vs_s2[a][t] = {
                "s1_asr": s1_asr,
                "s2_asr": s2_asr,
                "delta": round(s2_asr - s1_asr, 4) if s1_asr is not None and s2_asr is not None else None,
            }

    # Agent summary
    agent_summary = {}
    for a in AGENTS:
        exps = [e for e in s2 if e["agent"] == a]
        s1_exps = [e for e in s1 if e["agent"] == a]
        total_att = sum(e["attack_total"] for e in exps)
        total_suc = sum(e["attack_success"] for e in exps)
        total_tok = sum(e["total_tokens"] for e in exps)
        total_cost = sum(e["total_cost"] for e in exps)
        s1_att = sum(e["attack_total"] for e in s1_exps)
        s1_suc = sum(e["attack_success"] for e in s1_exps)
        s1_tok = sum(e["total_tokens"] for e in s1_exps)
        s1_cost = sum(e["total_cost"] for e in s1_exps)
        agent_summary[a] = {
            "s2_attacks": total_att,
            "s2_successes": total_suc,
            "s2_asr": safe_div(total_suc, total_att),
            "s2_tokens": total_tok,
            "s2_cost": total_cost,
            "s2_cost_per_success": safe_div(total_cost, total_suc),
            "s1_attacks": s1_att,
            "s1_successes": s1_suc,
            "s1_asr": safe_div(s1_suc, s1_att),
            "s1_tokens": s1_tok,
            "s1_cost": s1_cost,
            "s1_cost_per_success": safe_div(s1_cost, s1_suc),
        }

    # S1 Selection Rate per agent per technique
    s1_sel = defaultdict(lambda: defaultdict(float))
    s1_sessions = defaultdict(int)
    for e in s1:
        s1_sessions[e["agent"]] += 1
        for tech, vals in e.get("tech_table", {}).items():
            s1_sel[e["agent"]][tech] += vals["sel"]
    s1_sel_avg = {}
    for a in AGENTS:
        s1_sel_avg[a] = {}
        for t in TECHS:
            s1_sel_avg[a][t] = round(s1_sel[a].get(t, 0) / s1_sessions[a], 2) if s1_sessions[a] > 0 else 0

    # S2 Mismatch per agent per technique (1 - compliance)
    s2_mismatch = {}
    for a in AGENTS:
        s2_mismatch[a] = {}
        for t in TECHS:
            d = s2_by_agent_tech.get((a, t))
            if d and d["n"] > 0:
                # Mismatch = non-target attacks / total attacks
                exps = [e for e in s2 if e["agent"] == a and e["target_tech"] == t]
                mis_vals = []
                for e in exps:
                    if e["attack_total"] > 0:
                        mis_vals.append((e["attack_total"] - e["target_att"]) / e["attack_total"])
                s2_mismatch[a][t] = round(sum(mis_vals) / len(mis_vals), 4) if mis_vals else None
            else:
                s2_mismatch[a][t] = None

    # Bias chain tier summary
    all_entries = []
    for a in AGENTS:
        for t in TECHS:
            sel = s1_sel_avg[a].get(t, 0)
            comp = compliance[a].get(t)
            mis = s2_mismatch[a].get(t)
            if comp is not None and mis is not None:
                all_entries.append({"sel": sel, "comp": comp, "mis": mis})

    def tier_avg(entries, key):
        vals = [e[key] for e in entries]
        return round(sum(vals) / len(vals), 4) if vals else 0

    high = [e for e in all_entries if e["sel"] > 15]
    mid = [e for e in all_entries if 5 <= e["sel"] <= 15]
    low = [e for e in all_entries if e["sel"] < 5]

    bias_chain = {
        "high": {"n": len(high), "avg_comp": tier_avg(high, "comp"), "avg_mis": tier_avg(high, "mis")},
        "mid": {"n": len(mid), "avg_comp": tier_avg(mid, "comp"), "avg_mis": tier_avg(mid, "mis")},
        "low": {"n": len(low), "avg_comp": tier_avg(low, "comp"), "avg_mis": tier_avg(low, "mis")},
    }

    result = {
        "target_asr": target_asr,
        "compliance": compliance,
        "s1_vs_s2": s1_vs_s2,
        "agent_summary": agent_summary,
        "s1_sel": s1_sel_avg,
        "s2_mismatch": s2_mismatch,
        "bias_chain": bias_chain,
        "techniques": TECHS,
        "agents": AGENTS,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(result, f, ensure_ascii=False)

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"Written {OUTPUT_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
