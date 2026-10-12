"""CyBiasBench: a benchmark dataset for measuring bias in LLM offensive-security agents.

Two settings:
  - bias observation (free-choice): 180 sessions, 5 agents x 3 targets x 4 conditions x 3 reps.
  - bias injection (requested-family): 450 sessions, 5 agents x 3 targets x 10 families x 3 reps.
"""

from .load import (
    SettingFrames,
    load_bias_observation,
    load_bias_injection,
)

__version__ = "1.0.0"
__all__ = [
    "SettingFrames",
    "load_bias_observation",
    "load_bias_injection",
]
