"""Prompt-axis JSD per agent (paper Section 5.1).

Reproduces the within-agent Guided–Unguided / Structured–Unstructured JSD
and the between-agent pairwise JSD, plus a bar chart saved to
`figures/table2_jsd_robustness.png`.
"""
from collections import defaultdict
from itertools import combinations
import matplotlib.pyplot as plt
import numpy as np

from common import (AGENT_COLORS, AGENTS, AGENT_LABEL, FAMILIES,
                    FIG_DIR, banner, load_observation)


def jsd(p, q, eps=1e-12):
    p = np.asarray(p, dtype=float) + eps
    q = np.asarray(q, dtype=float) + eps
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)

    def kl(a, b):
        return np.sum(a * np.log2(a / b))

    return 0.5 * (kl(p, m) + kl(q, m))


def family_vec(records):
    counts = {f: 0.0 for f in FAMILIES}
    for r in records:
        att = r["attack_total"] or 0
        for fam, info in (r.get("family_table") or {}).items():
            if fam not in counts:
                continue
            sel = (info.get("selection_rate_pct") or 0) / 100.0
            counts[fam] += sel * att
    return [counts[f] for f in FAMILIES]


def main():
    observation = load_observation()
    by_agent = defaultdict(list)
    for r in observation:
        by_agent[r["agent"]].append(r)

    # condition codes: GS / GU / US / UU; first letter = guidance, second = output structure.
    def axis_split(records, axis):
        a, b = [], []
        for r in records:
            cond = r["condition"]
            if axis == "guidance":
                (a if cond.startswith("G") else b).append(r)
            else:
                (a if cond.endswith("S") else b).append(r)
        return a, b

    rows = []
    for agent in AGENTS:
        recs = by_agent[agent]
        guided, unguided = axis_split(recs, "guidance")
        structured, unstructured = axis_split(recs, "format")
        gu = jsd(family_vec(guided), family_vec(unguided))
        sus = jsd(family_vec(structured), family_vec(unstructured))
        rows.append((agent, gu, sus))

    banner("Prompt-axis JSD per agent")
    print(f"{'Agent':8} {'Guided–Unguided':>18} {'Structured–Unstructured':>26}")
    print("-" * 56)
    for agent, gu, sus in rows:
        print(f"{AGENT_LABEL[agent]:8} {gu:18.4f} {sus:26.4f}")
    mean_gu = sum(r[1] for r in rows) / len(rows)
    mean_sus = sum(r[2] for r in rows) / len(rows)
    print(f"{'Mean':8} {mean_gu:18.4f} {mean_sus:26.4f}")

    within_mean = (mean_gu + mean_sus) / 2
    print(f"\nWithin-agent mean JSD (both axes): {within_mean:.4f}")

    profiles = {agent: family_vec(by_agent[agent]) for agent in AGENTS}
    between = [jsd(profiles[a], profiles[b]) for a, b in combinations(AGENTS, 2)]
    between_mean = sum(between) / len(between)
    print(f"Between-agent mean pairwise JSD:   {between_mean:.4f}")
    print(f"  → ratio between/within = {between_mean / within_mean:.2f}×")

    fig, ax = plt.subplots(figsize=(7, 4.2))
    x = np.arange(len(rows))
    w = 0.36
    bar_colors = [AGENT_COLORS[r[0]] for r in rows]
    ax.bar(x - w / 2, [r[1] for r in rows], w, color=bar_colors,
           edgecolor="white", label="Guided–Unguided")
    ax.bar(x + w / 2, [r[2] for r in rows], w, color=bar_colors, alpha=0.45,
           edgecolor="white", label="Structured–Unstructured")
    ax.axhline(within_mean, color="tab:gray", linestyle="--",
               label=f"within-agent mean ({within_mean:.4f})")
    ax.axhline(between_mean, color="tab:red", linestyle="--",
               label=f"between-agent mean ({between_mean:.4f})")
    ax.set_xticks(x)
    ax.set_xticklabels([AGENT_LABEL[r[0]] for r in rows])
    ax.set_ylabel("JSD")
    ax.set_title("Prompt-axis JSD vs between-agent JSD")
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    out = FIG_DIR / "table2_jsd_robustness.png"
    fig.savefig(out, dpi=130)
    print(f"\nSaved: {out.relative_to(FIG_DIR.parent.parent)}")


if __name__ == "__main__":
    main()
