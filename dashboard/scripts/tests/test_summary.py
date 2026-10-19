"""Estimator edge cases independent of the checked-in dashboard snapshot."""
import json
import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_site_summary as builder
from build_site_summary import differences, injection_summary
from summary_metrics import observation_family_counts, pooled_observation_profiles, session_main_metrics


class SummaryEstimators(unittest.TestCase):
    def fixtures(self):
        obs = pd.DataFrame([
            {"record_id": "short", "attack_total": 10, "session_asr": .5},
            {"record_id": "long", "attack_total": 90, "session_asr": .1},
            {"record_id": "empty", "attack_total": 0, "session_asr": 0},
        ]).assign(agent="claude", target="test", condition="UU", attack_success=0, total_tokens=100)
        family = pd.DataFrame([
            {"record_id": "short", "attack_family": "sqli", "selection_rate_pct": 100., "asr": .5},
            {"record_id": "long", "attack_family": "xss", "selection_rate_pct": 100., "asr": .1},
        ]).assign(agent="claude", target="test", condition="UU")
        return obs, family

    def test_profiles_are_request_weighted_but_sessions_are_not(self):
        obs, family = self.fixtures()
        pooled = pooled_observation_profiles(obs, family).set_index(["agent", "attack_family"])
        self.assertAlmostEqual(pooled.loc[("claude", "sqli"), "sel_pct"], 10.)
        self.assertAlmostEqual(pooled.loc[("claude", "xss"), "sel_pct"], 90.)
        sessions = session_main_metrics(obs, family)
        self.assertEqual(len(sessions), 3)
        self.assertAlmostEqual(sessions.session_asr.mean(), .2)
        self.assertAlmostEqual(sessions.unique_main10.mean(), 2 / 3)
        self.assertEqual(sessions.set_index("record_id").loc["empty", "entropy_main10"], 0)

    def test_excluded_family_does_not_change_focal_entropy(self):
        obs, family = self.fixtures()
        obs = obs.iloc[:1].copy()
        family = pd.DataFrame([
            {"attack_family": "sqli", "selection_rate_pct": 25.},
            {"attack_family": "xss", "selection_rate_pct": 25.},
            {"attack_family": "deserialization", "selection_rate_pct": 50.},
        ]).assign(record_id="short", agent="claude", target="test", condition="UU", asr=0.)
        counts = observation_family_counts(obs, family)
        self.assertEqual(counts.attempts.sum(), 5.)
        row = session_main_metrics(obs, family).iloc[0]
        self.assertEqual(row.entropy_main10, 1.)
        self.assertEqual(row.top_share_main10, 50.)
        self.assertEqual(row.unique_main10, 2)

    def test_reconstructed_family_counts_remain_fractional(self):
        obs, family = self.fixtures()
        family.loc[0, "selection_rate_pct"] = 33.3333
        counts = observation_family_counts(obs, family)
        self.assertAlmostEqual(counts.iloc[0].attempts, 3.33333)

    def test_transfer_zero_fills_absent_families_but_scatter_keeps_null(self):
        pooled = pd.DataFrame({"agent": ["claude"] * 3, "attack_family": ["sqli", "xss", "csrf"],
                               "sel_pct": [40., 60., 0.], "asr": [.2, .8, np.nan]})
        inj = pd.DataFrame({"agent": ["claude"] * 3, "requested_family": ["sqli", "xss", "csrf"],
                            "compliance": [.1, .5, .9], "session_asr": [.2, .3, .4],
                            "requested_family_attempts": [10, 10, 0],
                            "requested_family_successes": [2, 8, 0]})
        rows, corr = injection_summary(inj, pooled)
        self.assertEqual(corr["asr_transfer"]["n"], 3)
        self.assertEqual(corr["asr_transfer"]["rho"], 1.)
        csrf = next(r for r in rows if r["family"] == "csrf")
        self.assertIsNone(csrf["asr_i"])
        self.assertIsNone(csrf["asr_i_s2"])

    def test_comparison_reports_missing_and_changed_fields(self):
        self.assertEqual(list(differences({"x": .1 + .2}, {"x": .3})), [])
        self.assertEqual(len(list(differences({"x": .1}, {"x": .2, "y": None}))), 2)

    def test_check_accepts_matching_summary_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "summary.json"
            text = '{"metric": 0.3}\n'
            path.write_text(text)
            with patch.object(builder, "build_summary", return_value={"metric": .1 + .2}), \
                 patch.object(sys, "argv", ["builder", "--check", "--summary", str(path)]):
                builder.main()
            self.assertEqual(path.read_text(), text)

    def test_check_rejects_stale_summary_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "summary.json"
            path.write_text(json.dumps({"metric": .1}))
            with patch.object(builder, "build_summary", return_value={"metric": .2}), \
                 patch.object(sys, "argv", ["builder", "--check", "--summary", str(path)]):
                with self.assertRaisesRegex(SystemExit, r"\$\.metric"):
                    builder.main()
            self.assertEqual(json.loads(path.read_text()), {"metric": .1})


if __name__ == "__main__":
    unittest.main()
