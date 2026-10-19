#!/usr/bin/env python3
"""Reproduce camera-ready uncertainty and request-unit sensitivity from public CSVs.

No model calls or human verdicts are generated. Success labels are the original
released automatic labels; this is NOT the expert-corrected success audit.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import random
import re
from pathlib import Path

import numpy as np
from scipy.special import rel_entr

AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]
NAMES = ["Claude", "Codex", "Gemini", "GLM", "Kimi"]
FAMILIES = ["sqli", "xss", "cmdi", "path_traversal", "auth_bypass", "idor",
            "ssrf", "csrf", "file_upload", "info_disclosure"]
UNITS = ["requests", "bursts", "episodes", "unique_probes", "presence"]
UNIT_NAMES = ["Raw requests", "Consecutive probe bursts", "Contiguous family episodes",
              "Unique probes/session", "Family presence/session"]


def read_csv(path):
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def normalize_path(path):
    """Remove query strings and map entire decimal path segments to {id}."""
    return re.sub(r"/\d+(?=/|$)", "/{id}", path.split("?", 1)[0])


def session_asr(data, scenario):
    records = read_csv(data / f"bias_{scenario}_records.csv")
    lookup = {r["record_id"]: r for r in records}
    assert len(lookup) == len(records)
    den, num = collections.Counter(), collections.Counter()
    for t in read_csv(data / f"bias_{scenario}_traces.csv"):
        rid = t["record_id"]
        assert rid in lookup, rid
        assert t["agent"] == lookup[rid]["agent"]
        if t["attack_family"] in ("", "others"):
            continue
        den[rid] += 1
        num[rid] += t["success"] == "True" and t["attack_family"] != "csrf"
    rates = {a: [] for a in AGENTS}
    for r in records:
        rid = r["record_id"]
        # These checks catch denominator changes, omitted empty sessions and
        # accidental replacement of the published automatic success policy.
        assert den[rid] == int(r["attack_total"]), rid
        assert num[rid] == int(r["attack_success"]), rid
        rate = num[rid] / den[rid] if den[rid] else 0.0
        # Injection records store session_asr rounded to four decimal places.
        # Reconstruct the exact ratio from trace counts before bootstrapping.
        assert abs(rate - float(r["session_asr"])) <= (5e-5 + 1e-12), rid
        rates[r["agent"]].append(rate)
    return records, rates


def bootstrap(obs, inj, draws, seed):
    # Match the documented Python RNG/percentile convention of the corrected
    # bootstrap script, using only its original-verifier baseline.
    rng = random.Random(seed)
    distributions = {a: [] for a in AGENTS + ["agent_equal_mean"]}
    for _ in range(draws):
        delta = []
        for a in AGENTS:
            o, i = obs[a], inj[a]
            mo = sum(rng.choices(o, k=len(o))) / len(o)
            mi = sum(rng.choices(i, k=len(i))) / len(i)
            delta.append(mi - mo)
            distributions[a].append(delta[-1])
        distributions["agent_equal_mean"].append(sum(delta) / len(delta))
    result = {}
    for a in AGENTS:
        result[a] = {"observation": float(np.mean(obs[a])), "injection": float(np.mean(inj[a])),
                     "n_observation": len(obs[a]), "n_injection": len(inj[a])}
    result["agent_equal_mean"] = {
        s: float(np.mean([result[a][s] for a in AGENTS])) for s in ("observation", "injection")}
    for a, values in distributions.items():
        values.sort()
        result[a]["delta"] = result[a]["injection"] - result[a]["observation"]
        result[a]["ci95"] = [values[int(.025 * draws)], values[int(.975 * draws) - 1]]
    return result


def mean_jsd(profiles):
    return float(np.mean([(rel_entr(p, (p + q) / 2).sum() + rel_entr(q, (p + q) / 2).sum())
                          / (2 * np.log(2)) for i, p in enumerate(profiles) for q in profiles[i + 1:]]))


def selection_units(data, records, permutations, seed):
    traces = collections.defaultdict(list)
    for t in read_csv(data / "bias_observation_traces.csv"):
        if t["attack_family"] in FAMILIES:
            traces[t["record_id"]].append(t)
    for rows in traces.values():
        rows.sort(key=lambda r: int(r["request_index"]))
        assert len({r["request_index"] for r in rows}) == len(rows)
    nonempty = [r for r in records if traces[r["record_id"]]]
    labels = np.array([AGENTS.index(r["agent"]) for r in nonempty])
    blocks = collections.defaultdict(list)
    matrices = {u: [] for u in UNITS}
    for idx, r in enumerate(nonempty):
        blocks[(r["target"], r["condition"])].append(idx)
        counts = {u: np.zeros(len(FAMILIES)) for u in UNITS}
        seen, previous_probe, previous_family = set(), None, None
        for t in traces[r["record_id"]]:
            family = t["attack_family"]
            fi = FAMILIES.index(family)
            rules = tuple(sorted(filter(None, t["matched_rules"].split(";"))))
            key = (family, t["req_method"], normalize_path(t["req_path"]), rules)
            counts["requests"][fi] += 1
            counts["bursts"][fi] += key != previous_probe
            counts["episodes"][fi] += family != previous_family
            counts["unique_probes"][fi] += key not in seen
            counts["presence"][fi] = 1
            seen.add(key)
            previous_probe, previous_family = key, family
        for u in UNITS:
            matrices[u].append(counts[u])
    matrices = {u: np.array(v) for u, v in matrices.items()}
    distributions = {u: v / v.sum(axis=1, keepdims=True) for u, v in matrices.items()}

    def statistic(d, lab):
        return mean_jsd(np.array([d[lab == a].mean(axis=0) for a in range(len(AGENTS))]))

    out, ge = {}, collections.Counter()
    for u in UNITS:
        counts = matrices[u]
        pooled = np.array([counts[labels == a].sum(axis=0) for a in range(len(AGENTS))])
        pooled /= pooled.sum(axis=1, keepdims=True)
        out[u] = {"pooled_jsd": mean_jsd(pooled), "session_macro_jsd": statistic(distributions[u], labels)}
    rng = np.random.default_rng(seed)
    for _ in range(permutations):
        shuffled = labels.copy()
        for indices in blocks.values():
            shuffled[indices] = rng.permutation(labels[indices])
        for u in UNITS:
            ge[u] += statistic(distributions[u], shuffled) >= out[u]["session_macro_jsd"] - 1e-15
    for u in UNITS:
        out[u]["blocked_p"] = (int(ge[u]) + 1) / (permutations + 1)
    target_results = {}
    for target in sorted({r["target"] for r in nonempty}):
        indices = np.array([j for j, r in enumerate(nonempty) if r["target"] == target])
        target_labels = labels[indices]
        d = distributions["requests"][indices]
        target_blocks = collections.defaultdict(list)
        for j, idx in enumerate(indices):
            target_blocks[nonempty[idx]["condition"]].append(j)
        observed = statistic(d, target_labels)
        count = 0
        for _ in range(permutations):
            shuffled = target_labels.copy()
            for block in target_blocks.values():
                shuffled[block] = rng.permutation(target_labels[block])
            count += statistic(d, shuffled) >= observed - 1e-15
        target_results[target] = {"sessions": len(indices), "session_macro_jsd": observed,
                                  "blocked_p": (count + 1) / (permutations + 1)}
    breadth = {a: float(np.mean([len({t["attack_family"] for t in traces[r["record_id"]]})
                                for r in records if r["agent"] == a])) for a in AGENTS}
    return {"n_sessions": len(nonempty), "empty_sessions_excluded_from_compositions": len(records)-len(nonempty),
            "units": out, "target_conditioned": target_results,
            "mean_families_per_session_including_empty": breadth}


def tex_tables(out, stats, compliance):
    lines = []
    for a, name in zip(AGENTS + ["agent_equal_mean"], NAMES + ["Agent-equal mean"]):
        v = stats["delta_asr"][a]
        ci = v["ci95"]
        c = f"{compliance[a]:.3f}" if a in compliance else "--"
        lines.append(f"{name} & {v['observation']:.3f} & {v['injection']:.3f} & {v['delta']:+.4f} & "
                     f"$[{ci[0]:+.4f}, {ci[1]:+.4f}]$ & {c} " + r"\\")
    (out / "delta_asr_rows.tex").write_text("\n".join(lines) + "\n")
    lines = []
    for u, name in zip(UNITS, UNIT_NAMES):
        v = stats["selection_units"]["units"][u]
        lines.append(f"{name} & {v['pooled_jsd']:.3f} & {v['session_macro_jsd']:.3f} & "
                     f"${v['blocked_p']:.4f}$ " + r"\\")
    (out / "request_unit_rows.tex").write_text("\n".join(lines) + "\n")
    lines = []
    for target, label in [("juice-shop", "Juice Shop"), ("mlflow", "MLflow"), ("vuln-shop", "Vuln-Shop")]:
        v = stats["selection_units"]["target_conditioned"][target]
        lines.append(f"{label} & {v['sessions']} & {v['session_macro_jsd']:.4f} & ${v['blocked_p']:.4f}$ " + r"\\")
    (out / "target_conditioned_rows.tex").write_text("\n".join(lines) + "\n")


def plot_ci(out, stats):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    names = NAMES + ["Agent-equal mean"]
    values = [stats["delta_asr"][a] for a in AGENTS + ["agent_equal_mean"]]
    y = np.arange(len(values))
    x = np.array([v["delta"] for v in values])
    lo = np.array([v["ci95"][0] for v in values])
    hi = np.array([v["ci95"][1] for v in values])
    with plt.rc_context({"font.family": "DejaVu Sans", "font.size": 9, "pdf.fonttype": 42}):
        fig, ax = plt.subplots(figsize=(5.2, 2.55), layout="constrained")
        ax.axvline(0, color="#777777", lw=.8, ls="--")
        ax.errorbar(x[:-1], y[:-1], xerr=np.array([x-lo, hi-x])[:, :-1],
                    fmt="o", color="#315f83", capsize=3, markersize=4, linewidth=1.2)
        ax.errorbar(x[-1], y[-1], xerr=np.array([[x[-1]-lo[-1]], [hi[-1]-x[-1]]]),
                    fmt="D", color="#171717", capsize=3, markersize=4, linewidth=1.5)
        ax.set(yticks=y, yticklabels=names, xlabel="Δ session ASR (injection − free choice)")
        ax.invert_yaxis()
        ax.spines[["top", "right", "left"]].set_visible(False)
        ax.grid(axis="x", alpha=.15)
        fig.savefig(out / "delta_asr_bootstrap.pdf", metadata={"CreationDate": None})
        fig.savefig(out / "delta_asr_bootstrap.png", dpi=180)
        plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--bootstrap-draws", type=int, default=20000)
    parser.add_argument("--permutations", type=int, default=1999)
    args = parser.parse_args()
    assert args.bootstrap_draws >= 1000 and args.permutations >= 999
    args.output_dir.mkdir(parents=True, exist_ok=True)
    orecs, obs = session_asr(args.data_dir, "observation")
    irecs, inj = session_asr(args.data_dir, "injection")
    assert len(orecs) == 180 and len(irecs) == 450
    result = {"metadata": {"success_policy": "original released automatic labels; CSRF never credited",
                           "unit": "session macro; zero-attack sessions included with ASR zero",
                           "bootstrap_strata": "agent x scenario (targets are not separately resampled)",
                           "bootstrap_draws": args.bootstrap_draws, "bootstrap_seed": 20260725,
                           "selection_permutations": args.permutations, "selection_seed": 20261017,
                           "permutation_blocks": "target x prompt condition; complete nonempty sessions",
                           "probe_key": "family, HTTP method, path without query and decimal segments mapped to {id}, sorted matched_rules",
                           "consecutive_scope": "sequence of focal-family requests within each session",
                           "human_audit_included": False},
              "input_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in sorted(args.data_dir.glob("*_records.csv")) + sorted(args.data_dir.glob("*_traces.csv"))},
              "delta_asr": bootstrap(obs, inj, args.bootstrap_draws, 20260725),
              "selection_units": selection_units(args.data_dir, orecs, args.permutations, 20261017)}
    compliance = {a: float(np.mean([float(r["compliance"]) for r in irecs if r["agent"] == a])) for a in AGENTS}
    tex_tables(args.output_dir, result, compliance)
    plot_ci(args.output_dir, result)
    (args.output_dir / "reviewer_revision_stats.json").write_text(json.dumps(result, indent=2) + "\n")
    print("Trace-to-record closure: 630/630 sessions, zero mismatches.")
    print(json.dumps({"delta_asr": result["delta_asr"], "selection_units": result["selection_units"]}, indent=2))


if __name__ == "__main__":
    main()
