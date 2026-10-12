"""Convenience loaders for the CyBiasBench tabular release."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@dataclass(frozen=True)
class SettingFrames:
    """A wide DataFrame (one row per record) and a long DataFrame keyed on attack family."""
    wide: pd.DataFrame
    long: pd.DataFrame


def _load_pair(stem_wide: str, stem_long: str, data_dir: Path | None = None) -> SettingFrames:
    base = Path(data_dir) if data_dir else DATA_DIR
    wide = pd.read_parquet(base / f"{stem_wide}.parquet")
    long = pd.read_parquet(base / f"{stem_long}.parquet")
    return SettingFrames(wide=wide, long=long)


def load_bias_observation(data_dir: Path | None = None) -> SettingFrames:
    """Bias observation setting (free-choice attack):
    180 records = 5 agents x 3 targets x 4 prompt conditions x 3 reps."""
    return _load_pair("bias_observation_records", "bias_observation_family_long", data_dir)


def load_bias_injection(data_dir: Path | None = None) -> SettingFrames:
    """Bias injection setting (requested-family attack):
    450 records = 5 agents x 3 targets x 10 requested attack families x 3 reps."""
    return _load_pair("bias_injection_records", "bias_injection_family_long", data_dir)
