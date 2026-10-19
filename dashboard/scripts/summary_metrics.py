"""Public-data estimators used by the dashboard summary builder.

Keep focal-family normalization and session aggregation explicit: session ASR
uses all classified families; selection and diversity use the focal ten only.
"""
from __future__ import annotations

import math
import numpy as np
import pandas as pd
from scipy.stats import kruskal

AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]
AGENTS_CANONICAL = AGENTS
FAMILIES = ["sqli", "xss", "cmdi", "path_traversal", "auth_bypass", "idor",
            "ssrf", "csrf", "file_upload", "info_disclosure"]
CONDITIONS = ["UU", "US", "GU", "GS"]


def observation_family_counts(obs: pd.DataFrame, obs_long: pd.DataFrame) -> pd.DataFrame:
    """Return ten-family long form with reconstructed attempts and successes.

    `selection_rate_pct` is the public artifact's per-session Sel_i on a
    0--100 scale. We reconstruct per-family attempts from the public wide row:
    attempts_i = attack_total * selection_rate_pct_i / 100.
    """
    wide = obs[["record_id", "agent", "target", "condition", "attack_total", "session_asr", "total_tokens"]]
    df = obs_long[obs_long["attack_family"].isin(FAMILIES)].merge(
        wide, on=["record_id", "agent", "target", "condition"], how="left"
    )
    df["attempts"] = df["attack_total"] * df["selection_rate_pct"] / 100.0
    df["success"] = df["attempts"] * df["asr"].fillna(0.0)
    return df


def session_main_metrics(obs: pd.DataFrame, obs_long: pd.DataFrame) -> pd.DataFrame:
    """Recompute ten-family entropy/top-family/unique counts per session."""
    counts = observation_family_counts(obs, obs_long)
    grouped = counts.groupby("record_id", sort=False)
    rows = []
    wide = obs.set_index("record_id")
    for record_id, g in grouped:
        fam_attempts = {family: 0.0 for family in FAMILIES}
        for row in g.itertuples(index=False):
            fam_attempts[row.attack_family] += float(row.attempts)
        total = sum(fam_attempts.values())
        probs = {family: (value / total if total else 0.0) for family, value in fam_attempts.items()}
        entropy = -sum(p * math.log2(p) for p in probs.values() if p > 0)
        top_family = max(probs, key=probs.get) if total else None
        rows.append(
            {
                "record_id": record_id,
                "agent": wide.loc[record_id, "agent"],
                "target": wide.loc[record_id, "target"],
                "condition": wide.loc[record_id, "condition"],
                "attack_total_main10": total,
                "entropy_main10": entropy,
                "unique_main10": sum(1 for value in fam_attempts.values() if value > 0),
                "top_family_main10": top_family,
                "top_share_main10": (probs[top_family] * 100.0 if top_family else 0.0),
                "session_asr": wide.loc[record_id, "session_asr"],
                "attack_success": wide.loc[record_id, "attack_success"],
                "total_tokens": wide.loc[record_id, "total_tokens"],
            }
        )
    # Preserve sessions with zero main-family attempts, if any.
    present = {r["record_id"] for r in rows}
    for record_id, row in obs[~obs["record_id"].isin(present)].set_index("record_id").iterrows():
        rows.append(
            {
                "record_id": record_id,
                "agent": row["agent"],
                "target": row["target"],
                "condition": row["condition"],
                "attack_total_main10": 0.0,
                "entropy_main10": 0.0,
                "unique_main10": 0,
                "top_family_main10": None,
                "top_share_main10": 0.0,
                "session_asr": row["session_asr"],
                "attack_success": row["attack_success"],
                "total_tokens": row["total_tokens"],
            }
        )
    return pd.DataFrame(rows)


def pooled_observation_profiles(obs: pd.DataFrame, obs_long: pd.DataFrame) -> pd.DataFrame:
    """Agent-family pooled Sel_i and ASR_i over the bias observation setting."""
    counts = observation_family_counts(obs, obs_long)
    rows = []
    for agent in AGENTS_CANONICAL:
        sub = counts[counts["agent"] == agent]
        totals = sub.groupby("attack_family")[["attempts", "success"]].sum()
        total_attempts = totals["attempts"].sum()
        for family in FAMILIES:
            attempts = float(totals.loc[family, "attempts"]) if family in totals.index else 0.0
            success = float(totals.loc[family, "success"]) if family in totals.index else 0.0
            rows.append(
                {
                    "agent": agent,
                    "attack_family": family,
                    "attempts": attempts,
                    "success": success,
                    "sel_pct": (100.0 * attempts / total_attempts if total_attempts else 0.0),
                    "asr": (success / attempts if attempts else np.nan),
                }
            )
    return pd.DataFrame(rows)


def condition_profiles(obs: pd.DataFrame, obs_long: pd.DataFrame) -> pd.DataFrame:
    """Pooled ten-family selection by agent and prompt condition."""
    counts = observation_family_counts(obs, obs_long)
    grouped = counts.groupby(["agent", "condition", "attack_family"], as_index=False)[["attempts"]].sum()
    totals = grouped.groupby(["agent", "condition"])["attempts"].transform("sum")
    grouped["sel_pct"] = np.where(totals > 0, 100.0 * grouped["attempts"] / totals, 0.0)

    full_index = pd.MultiIndex.from_product(
        [AGENTS_CANONICAL, CONDITIONS, FAMILIES], names=["agent", "condition", "attack_family"]
    )
    grouped = grouped.set_index(["agent", "condition", "attack_family"]).reindex(full_index, fill_value=0.0).reset_index()
    totals = grouped.groupby(["agent", "condition"])["attempts"].transform("sum")
    grouped["sel_pct"] = np.where(totals > 0, 100.0 * grouped["attempts"] / totals, 0.0)
    return grouped


def kruskal_eta2(groups: list[np.ndarray | list[float]]) -> tuple[float, float, float]:
    stat, pvalue = kruskal(*groups)
    n = sum(len(g) for g in groups)
    k = len(groups)
    eta2 = (stat - k + 1) / (n - k)
    return float(stat), float(pvalue), float(eta2)


def js_divergence(p, q) -> float:
    """Jensen-Shannon divergence in bits for two nonnegative vectors."""
    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)
    p = p / p.sum() if p.sum() > 0 else p
    q = q / q.sum() if q.sum() > 0 else q
    m = 0.5 * (p + q)

    def kl_divergence(a, b) -> float:
        mask = a > 0
        return float(np.sum(a[mask] * np.log2(a[mask] / b[mask])))

    return 0.5 * kl_divergence(p, m) + 0.5 * kl_divergence(q, m)
