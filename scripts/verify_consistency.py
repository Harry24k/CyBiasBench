"""Sanity checks for the CyBiasBench tabular release.

Verifies:
  - Row counts (180 observation, 450 injection) and 3 reps per design cell
  - Long-form sums match wide-form aggregates (where applicable)
  - Domains for categorical columns
  - record_id is unique per wide row

Pass --round-trip to additionally re-derive `attack_total` and
`attack_success` per record_id directly from the released traces
(applying the CSRF success-exclusion policy from
`scripts/aggregate/bias_observation.py` and
`scripts/aggregate/bias_injection.py`) and confirm the result equals
the released records exactly.

Exits non-zero on any failure.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parents[1] / "data"

EXPECTED_AGENTS = {"claude", "codex", "gemini", "kimi", "glm"}
EXPECTED_TARGETS = {"juice-shop", "mlflow", "vuln-shop"}
EXPECTED_CONDITIONS = {"GS", "GU", "US", "UU"}
EXPECTED_REQUESTED_FAMILIES = {
    "auth_bypass", "cmdi", "csrf", "file_upload", "idor",
    "info_disclosure", "path_traversal", "sqli", "ssrf", "xss",
}
KNOWN_FAMILIES = EXPECTED_REQUESTED_FAMILIES | {"deserialization"}


def check(label: str, ok: bool, detail: str = "") -> bool:
    mark = "OK " if ok else "FAIL"
    print(f"[{mark}] {label}{(' — ' + detail) if detail else ''}")
    return ok


def verify_observation() -> bool:
    wide = pd.read_csv(DATA / "bias_observation_records.csv")
    long = pd.read_csv(DATA / "bias_observation_family_long.csv")
    ok = True
    ok &= check("observation wide rows == 180", len(wide) == 180, str(len(wide)))
    ok &= check("observation record_id unique",
                wide.record_id.is_unique,
                f"{wide.record_id.nunique()} unique of {len(wide)}")
    cells = wide.groupby(["agent", "target", "condition"]).size()
    ok &= check("observation 60 cells x 3 reps",
                len(cells) == 60 and (cells == 3).all(),
                f"{len(cells)} cells, reps min={cells.min()} max={cells.max()}")
    ok &= check("observation agents domain",
                set(wide.agent.unique()) == EXPECTED_AGENTS)
    ok &= check("observation targets domain",
                set(wide.target.unique()) == EXPECTED_TARGETS)
    ok &= check("observation conditions domain",
                set(wide.condition.unique()) == EXPECTED_CONDITIONS)
    ok &= check("observation long families within known set",
                set(long.attack_family.unique()).issubset(KNOWN_FAMILIES),
                f"unexpected: {set(long.attack_family.unique()) - KNOWN_FAMILIES}")
    ok &= check("observation long has at most 11 families per record",
                long.groupby("record_id").size().max() <= 11)
    return ok


def verify_injection() -> bool:
    wide = pd.read_csv(DATA / "bias_injection_records.csv")
    long = pd.read_csv(DATA / "bias_injection_family_long.csv")
    ok = True
    ok &= check("injection wide rows == 450", len(wide) == 450, str(len(wide)))
    ok &= check("injection record_id unique",
                wide.record_id.is_unique,
                f"{wide.record_id.nunique()} unique of {len(wide)}")
    cells = wide.groupby(["agent", "target", "requested_family"]).size()
    ok &= check("injection 150 cells x 3 reps",
                len(cells) == 150 and (cells == 3).all(),
                f"{len(cells)} cells, reps min={cells.min()} max={cells.max()}")
    ok &= check("injection agents domain",
                set(wide.agent.unique()) == EXPECTED_AGENTS)
    ok &= check("injection targets domain",
                set(wide.target.unique()) == EXPECTED_TARGETS)
    ok &= check("injection requested_family domain",
                set(wide.requested_family.unique()) == EXPECTED_REQUESTED_FAMILIES)
    ok &= check("injection long families within known set",
                set(long.attack_family.unique()).issubset(KNOWN_FAMILIES))

    g = long.groupby("record_id").agg(att=("attempts", "sum"),
                                      succ=("success", "sum")).reset_index()
    merged = wide.merge(g, on="record_id", how="left").fillna({"att": 0, "succ": 0})
    ok &= check("injection long attempts == wide attack_total per record",
                (merged.att == merged.attack_total).all(),
                f"mismatched in {(merged.att != merged.attack_total).sum()} rows")
    ok &= check("injection long success == wide attack_success per record",
                (merged.succ == merged.attack_success).all(),
                f"mismatched in {(merged.succ != merged.attack_success).sum()} rows")
    return ok


def verify_traces() -> bool:
    """Cross-check the request-level trace files against the aggregate records."""
    obs_records = pd.read_parquet(DATA / "bias_observation_records.parquet")
    obs_traces = pd.read_parquet(DATA / "bias_observation_traces.parquet")
    inj_records = pd.read_parquet(DATA / "bias_injection_records.parquet")
    inj_traces = pd.read_parquet(DATA / "bias_injection_traces.parquet")
    ok = True
    ok &= check("observation traces have known scenario",
                set(obs_traces.scenario.unique()) == {"bias_observation"})
    ok &= check("injection traces have known scenario",
                set(inj_traces.scenario.unique()) == {"bias_injection"})
    ok &= check("observation traces record_id ⊆ records record_id",
                set(obs_traces.record_id.unique()).issubset(set(obs_records.record_id)))
    ok &= check("injection traces record_id ⊆ records record_id",
                set(inj_traces.record_id.unique()).issubset(set(inj_records.record_id)))

    for label, records, traces in [
        ("observation", obs_records, obs_traces),
        ("injection", inj_records, inj_traces),
    ]:
        attack_traces = traces[traces.attack_family != "others"]
        per_rid = attack_traces.groupby("record_id").size().rename("ta")
        merged = records.set_index("record_id").join(per_rid).fillna(0)
        merged["ta"] = merged["ta"].astype(int)
        differing = merged.index[merged.attack_total != merged.ta]
        ok &= check(
            f"{label} trace attack_total == records.attack_total",
            len(differing) == 0,
            f"mismatched in {len(differing)} of {len(merged)} rows",
        )
    return ok


def verify_round_trip() -> bool:
    """Round-trip closure: re-derive `attack_total` and `attack_success`
    per record_id directly from the released traces, applying the CSRF
    success-exclusion policy that the aggregators enforce (canonical
    expression of this policy lives in
    `scripts/aggregate/bias_observation.py` and
    `scripts/aggregate/bias_injection.py`). The reconstructed counts must
    equal the released records exactly."""
    obs_records = pd.read_parquet(DATA / "bias_observation_records.parquet").set_index("record_id")
    obs_traces  = pd.read_parquet(DATA / "bias_observation_traces.parquet")
    inj_records = pd.read_parquet(DATA / "bias_injection_records.parquet").set_index("record_id")
    inj_traces  = pd.read_parquet(DATA / "bias_injection_traces.parquet")

    ok = True
    for label, recs, trc in [
        ("observation", obs_records, obs_traces),
        ("injection",   inj_records, inj_traces),
    ]:
        attacks = trc[trc.attack_family != "others"]
        # CSRF success exclusion: aggregate attack_success only counts
        # successes from non-CSRF families.
        non_csrf_succ = attacks[(attacks.attack_family != "csrf") & (attacks.success)]

        derived_total = attacks.groupby("record_id").size().rename("derived_total")
        derived_success = non_csrf_succ.groupby("record_id").size().rename("derived_success")

        m = (recs[["attack_total", "attack_success"]]
             .join(derived_total).join(derived_success)
             .fillna(0).astype(int))
        diff_total = int((m.derived_total != m.attack_total).sum())
        diff_succ  = int((m.derived_success != m.attack_success).sum())
        ok &= check(
            f"{label} round-trip attack_total reproduced from traces",
            diff_total == 0,
            f"mismatched in {diff_total} of {len(m)} rows",
        )
        ok &= check(
            f"{label} round-trip attack_success reproduced (CSRF excluded)",
            diff_succ == 0,
            f"mismatched in {diff_succ} of {len(m)} rows",
        )
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--round-trip", action="store_true",
                    help="Add the round-trip closure check (re-derive records "
                         "counts from released traces, applying the CSRF "
                         "success-exclusion policy).")
    args = ap.parse_args()

    ok = True
    ok &= verify_observation()
    ok &= verify_injection()
    ok &= verify_traces()
    if args.round_trip:
        ok &= verify_round_trip()
    if not ok:
        sys.exit(1)
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
