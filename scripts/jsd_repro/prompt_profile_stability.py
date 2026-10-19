"""Per-condition Prompt-stability JSD against agent centroid (paper Appendix B).

For each agent, computes the four per-condition family distributions and
their JSD against the agent centroid (raw counts summed over conditions,
then normalized). Saves a small-multiples figure to
`figures/prompt_profile_stability_centroid.png`.
"""
from __future__ import annotations

from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
import numpy as np

from common import (
    AGENTS,
    AGENT_COLORS,
    AGENT_LABEL,
    FAMILIES,
    FIG_DIR,
    KEY_CANVAS_W,
    PAPER_BG,
    PAPER_GRID,
    PAPER_MUTED,
    PAPER_SPINE,
    add_key_figure_header,
    apply_paper_style,
    load_observation,
    save_key_figure,
)

DISPLAY_FAMILIES = {
    "auth_bypass": "Auth",
    "file_upload": "Upload",
    "idor": "IDOR",
    "info_disclosure": "Info",
    "path_traversal": "Path",
    "sqli": "SQLi",
    "ssrf": "SSRF",
    "xss": "XSS",
    "cmdi": "CMD",
    "csrf": "CSRF",
}

PLOT_ORDER = [
    "auth_bypass",
    "file_upload",
    "idor",
    "info_disclosure",
    "path_traversal",
    "sqli",
    "ssrf",
    "xss",
    "cmdi",
    "csrf",
]

COND_ORDER = ["UU", "US", "GU", "GS"]
COND_STYLES = {
    "UU": {"color": "#1f1f1f", "linestyle": "-", "marker": "o"},
    "US": {"color": "#3b7ddd", "linestyle": "--", "marker": "s"},
    "GU": {"color": "#e07a5f", "linestyle": "-.", "marker": "^"},
    "GS": {"color": "#2a9d8f", "linestyle": ":", "marker": "D"},
}


def normalize_profile(values):
    arr = np.asarray(values, dtype=float)
    total = arr.sum()
    if total <= 0:
        return arr
    return arr / total


def jsd(p, q, eps=1e-12):
    p = normalize_profile(np.asarray(p, dtype=float) + eps)
    q = normalize_profile(np.asarray(q, dtype=float) + eps)
    m = 0.5 * (p + q)
    return 0.5 * np.sum(p * np.log2(p / m)) + 0.5 * np.sum(q * np.log2(q / m))


def family_counts(records):
    counts = {fam: 0.0 for fam in FAMILIES}
    for rec in records:
        attack_total = rec.get("attack_total") or 0
        for fam, info in (rec.get("family_table") or {}).items():
            if fam not in counts:
                continue
            counts[fam] += attack_total * ((info.get("selection_rate_pct") or 0) / 100.0)
    return np.array([counts[fam] for fam in PLOT_ORDER], dtype=float)


def canonical_condition(name):
    return (name or "").replace("-", "").upper()


def build_profiles(observation):
    by_agent = defaultdict(list)
    for rec in observation:
        by_agent[rec["agent"]].append(rec)

    profiles = {}
    for agent in AGENTS:
        cond_groups = defaultdict(list)
        for rec in by_agent[agent]:
            cond_groups[canonical_condition(rec.get("condition"))].append(rec)

        raw_profiles = {}
        norm_profiles = {}
        for cond in COND_ORDER:
            raw_profiles[cond] = family_counts(cond_groups.get(cond, []))
            norm_profiles[cond] = normalize_profile(raw_profiles[cond])

        centroid_reference = normalize_profile(sum(raw_profiles.values()))

        profiles[agent] = {
            "conditions": norm_profiles,
            "centroid_reference": centroid_reference,
            "mean_jsd_to_centroid": float(np.mean([jsd(v, centroid_reference) for v in norm_profiles.values()])),
            "max_jsd_to_centroid": float(np.max([jsd(v, centroid_reference) for v in norm_profiles.values()])),
        }
    return profiles


def save_figure(profiles, out_dir=FIG_DIR):
    ref_key = "centroid_reference"
    mean_key = "mean_jsd_to_centroid"
    max_key = "max_jsd_to_centroid"
    ref_label = "Agent centroid"
    title = "Prompt Conditions Remain Near Agent Centroids"
    subtitle = "Within each model, condition-specific family profiles stay close to the agent-level centroid."
    out_name = "prompt_profile_stability_centroid.png"

    apply_paper_style(base_font_size=13)

    fig = plt.figure(figsize=(KEY_CANVAS_W, 8.6))
    fig.patch.set_facecolor(PAPER_BG)
    gs = GridSpec(2, 6, figure=fig)
    axes = [
        fig.add_subplot(gs[0, 0:2]),
        fig.add_subplot(gs[0, 2:4]),
        fig.add_subplot(gs[0, 4:6]),
        fig.add_subplot(gs[1, 1:3]),
        fig.add_subplot(gs[1, 3:5]),
    ]
    x = np.arange(len(PLOT_ORDER))
    y_max = 0.0
    for agent in AGENTS:
        agent_profiles = profiles[agent]["conditions"].values()
        y_max = max(y_max, max(float(np.max(v)) for v in agent_profiles), float(np.max(profiles[agent][ref_key])))
    y_limit = min(0.6, max(0.25, y_max * 1.18))

    for idx, agent in enumerate(AGENTS):
        ax = axes[idx]
        ax.set_facecolor(PAPER_BG)
        reference = profiles[agent][ref_key]
        cond_profiles = profiles[agent]["conditions"]
        stacked = np.vstack([cond_profiles[cond] for cond in COND_ORDER])

        ax.fill_between(
            x,
            stacked.min(axis=0),
            stacked.max(axis=0),
            color=AGENT_COLORS[agent],
            alpha=0.18,
            zorder=1,
            label="Condition range" if idx == 0 else None,
        )
        ax.plot(
            x,
            reference,
            color=AGENT_COLORS[agent],
            linewidth=4.35,
            alpha=0.98,
            zorder=3,
            label=ref_label if idx == 0 else None,
        )

        for cond in COND_ORDER:
            style = COND_STYLES[cond]
            ax.plot(
                x,
                cond_profiles[cond],
                linewidth=1.2,
                markersize=4.2,
                alpha=0.48,
                label=cond if idx == 0 else None,
                zorder=4,
                **style,
            )

        ax.set_title(AGENT_LABEL[agent], fontweight="bold", color=AGENT_COLORS[agent], pad=47, fontsize=20)
        ax.text(
            0.5,
            1.115,
            f"mean {profiles[agent][mean_key]:.3f}   max {profiles[agent][max_key]:.3f}",
            transform=ax.transAxes,
            ha="center",
            va="bottom",
            fontsize=14.2,
            color=PAPER_MUTED,
        )
        ax.grid(True, color=PAPER_GRID, linestyle=":", linewidth=0.8, alpha=0.7)
        ax.set_axisbelow(True)
        ax.set_ylim(0, y_limit)
        ax.set_yticks(np.linspace(0, y_limit, 6))
        if idx in (0, 3):
            ax.set_ylabel("Normalized Family Share", fontsize=15.5, fontweight="semibold")

        for spine in ax.spines.values():
            spine.set_color(PAPER_SPINE)
            spine.set_linewidth(0.9)

        ax.set_xticks(x)
        ax.set_xticklabels([DISPLAY_FAMILIES[fam] for fam in PLOT_ORDER], rotation=34, ha="right")
        ax.tick_params(axis="x", pad=6, labelsize=12.4)
        ax.tick_params(axis="both", length=3.8, width=1.0)

    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", bbox_to_anchor=(0.5, 0.872), ncol=6, frameon=False, prop={"size": 14.2})
    add_key_figure_header(fig, title, subtitle)
    fig.tight_layout(rect=[0.03, 0.05, 0.995, 0.82], w_pad=1.9, h_pad=2.6)

    out = out_dir / out_name
    save_key_figure(fig, out)
    plt.close(fig)
    print(f"Saved: {out.relative_to(out_dir.parent.parent)}")


def main():
    profiles = build_profiles(load_observation())
    save_figure(profiles)


if __name__ == "__main__":
    main()
