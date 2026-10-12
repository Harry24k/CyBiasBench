"""Build the released CSV / Parquet record tables from the per-session JSON
written by `scripts/aggregate/`.

Inputs (under --src):
  bias_observation_stats.json
  bias_injection_stats.json

Outputs (under --out):
  bias_observation_records.{csv,parquet}        wide, one row per session
  bias_observation_family_long.{csv,parquet}    long, one row per (session, family)
  bias_injection_records.{csv,parquet}
  bias_injection_family_long.{csv,parquet}
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = REPO_ROOT / "data"
DEFAULT_OUT = REPO_ROOT / "data"

OBSERVATION_WIDE_COLUMNS = [
    "record_id", "agent", "target", "condition",
    "attack_total", "attack_success", "session_asr",
    "entropy", "most_selected_family", "selection_cr1",
    "total_tokens",
]
OBSERVATION_LONG_COLUMNS = [
    "record_id", "agent", "target", "condition",
    "attack_family", "selection_rate_pct", "asr",
]
INJECTION_WIDE_COLUMNS = [
    "record_id", "agent", "target", "requested_family", "rep",
    "attack_total", "attack_success", "session_asr",
    "requested_family_attempts", "requested_family_successes", "requested_family_asr",
    "compliance",
    "total_tokens",
]
INJECTION_LONG_COLUMNS = [
    "record_id", "agent", "target", "requested_family", "rep",
    "attack_family", "attempts", "success",
]


def make_record_id(dir_name: str, agent: str) -> str:
    # Some upstream session directories bundled three agents in one folder;
    # in those cases append the agent name to keep record_id unique.
    return dir_name if f"_{agent}_" in dir_name else f"{dir_name}__{agent}"


def build_observation(records: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    wide_rows, long_rows = [], []
    for r in records:
        rid = make_record_id(r["dir"], r["agent"])
        wide_rows.append({
            "record_id":      rid,
            "agent":          r["agent"],
            "target":         r["target"],
            "condition":      r["condition"],
            "attack_total":   r["attack_total"],
            "attack_success": r["attack_success"],
            "session_asr":    r["session_asr"],
            "entropy":        r["entropy"],
            "most_selected_family": r["most_selected_family"],
            "selection_cr1":        r["selection_cr1"],
            "total_tokens":   r["total_tokens"],
        })
        for fam, t in (r.get("family_table") or {}).items():
            long_rows.append({
                "record_id":          rid,
                "agent":              r["agent"],
                "target":             r["target"],
                "condition":          r["condition"],
                "attack_family":      fam,
                "selection_rate_pct": t["selection_rate_pct"],
                "asr":                t["asr"],
            })
    return (pd.DataFrame(wide_rows, columns=OBSERVATION_WIDE_COLUMNS),
            pd.DataFrame(long_rows, columns=OBSERVATION_LONG_COLUMNS))


def build_injection(records: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    wide_rows, long_rows = [], []
    for r in records:
        rid = make_record_id(r["dir"], r["agent"])
        requested_family = r["requested_family"]
        wide_rows.append({
            "record_id":                   rid,
            "agent":                       r["agent"],
            "target":                      r["target"],
            "requested_family":            requested_family,
            "rep":                         r["rep"],
            "attack_total":                r["attack_total"],
            "attack_success":              r["attack_success"],
            "session_asr":                 r["session_asr"],
            "requested_family_attempts":   r["requested_family_attempts"],
            "requested_family_successes":  r["requested_family_successes"],
            "requested_family_asr":        r["requested_family_asr"],
            "compliance":                  r["compliance"],
            "total_tokens":                r["total_tokens"],
        })
        for fam, t in (r.get("family_table") or {}).items():
            long_rows.append({
                "record_id":     rid,
                "agent":         r["agent"],
                "target":        r["target"],
                "requested_family": requested_family,
                "rep":           r["rep"],
                "attack_family": fam,
                "attempts":      t["attempts"],
                "success":       t["success"],
            })
    return (pd.DataFrame(wide_rows, columns=INJECTION_WIDE_COLUMNS),
            pd.DataFrame(long_rows, columns=INJECTION_LONG_COLUMNS))


def write_outputs(df: pd.DataFrame, stem: Path) -> None:
    csv_path = stem.with_suffix(".csv")
    pq_path  = stem.with_suffix(".parquet")
    df.to_csv(csv_path, index=False)
    df.to_parquet(pq_path, index=False)
    print(f"wrote {csv_path.name}: {len(df)} rows, {len(df.columns)} cols")
    print(f"wrote {pq_path.name}: {len(df)} rows, {len(df.columns)} cols")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC,
                    help="Directory containing the aggregator JSON outputs.")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help="Output directory for the released CSV / Parquet tables.")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    obs = json.load((args.src / "bias_observation_stats.json").open())
    obs_wide, obs_long = build_observation(obs)
    write_outputs(obs_wide, args.out / "bias_observation_records")
    write_outputs(obs_long, args.out / "bias_observation_family_long")

    inj = json.load((args.src / "bias_injection_stats.json").open())
    inj_wide, inj_long = build_injection(inj)
    write_outputs(inj_wide, args.out / "bias_injection_records")
    write_outputs(inj_long, args.out / "bias_injection_family_long")


if __name__ == "__main__":
    main()
