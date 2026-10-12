"""Shared loaders and visual style for the JSD reproduction scripts.

The two JSD scripts read the released parquet artefacts under `data/` via
`load_observation` / `load_injection` and reconstruct the per-session
record shape they consume.
"""
from __future__ import annotations
from pathlib import Path

import matplotlib as mpl
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
FIG_DIR = Path(__file__).resolve().parent / "figures"
FIG_DIR.mkdir(exist_ok=True)

AGENTS = ["claude", "codex", "gemini", "glm", "kimi"]
AGENT_LABEL = {"claude": "Claude", "codex": "Codex", "gemini": "Gemini",
               "glm": "GLM", "kimi": "Kimi"}

# Vendor brand colors - Anthropic clay, OpenAI teal, Google blue,
# Zhipu purple, Moonshot crimson.
AGENT_COLORS = {
    "claude": "#D97757",
    "codex":  "#10A37F",
    "gemini": "#4285F4",
    "glm":    "#8B5CF6",
    "kimi":   "#DC2626",
}

FAMILIES = [
    "sqli", "xss", "cmdi", "path_traversal", "auth_bypass",
    "idor", "ssrf", "csrf", "file_upload", "info_disclosure",
]

PAPER_BG = "#FFFFFF"
PAPER_TEXT = "#111827"
PAPER_MUTED = "#475569"
PAPER_GRID = "#DBE4F0"
PAPER_SPINE = "#CBD5E1"

KEY_TITLE_SIZE = 20.5
KEY_SUBTITLE_SIZE = 13.6
KEY_TITLE_Y = 0.965
KEY_SUBTITLE_Y = 0.918
KEY_FIG_DPI = 180
KEY_CANVAS_W = 13.2


def apply_paper_style(base_font_size=13):
    mpl.rcParams.update({
        "figure.facecolor":   PAPER_BG,
        "axes.facecolor":     PAPER_BG,
        "savefig.facecolor":  PAPER_BG,
        "savefig.transparent": False,
        "font.family":        "DejaVu Serif",
        "mathtext.fontset":   "dejavuserif",
        "text.color":         PAPER_TEXT,
        "axes.labelcolor":    PAPER_TEXT,
        "axes.edgecolor":     PAPER_SPINE,
        "axes.titlecolor":    PAPER_TEXT,
        "xtick.color":        PAPER_MUTED,
        "ytick.color":        PAPER_MUTED,
        "grid.color":         PAPER_GRID,
        "grid.linestyle":     ":",
        "grid.linewidth":     0.9,
        "axes.grid":          False,
        "font.size":          base_font_size,
        "axes.titlesize":     base_font_size + 8,
        "axes.labelsize":     base_font_size + 3,
        "xtick.labelsize":    base_font_size - 0.5,
        "ytick.labelsize":    base_font_size,
        "legend.fontsize":    base_font_size,
    })


def add_key_figure_header(fig, title, subtitle,
                          title_y=KEY_TITLE_Y, subtitle_y=KEY_SUBTITLE_Y):
    fig.text(0.5, title_y, title, ha="center", va="top",
             fontsize=KEY_TITLE_SIZE, fontweight="semibold")
    fig.text(0.5, subtitle_y, subtitle, ha="center", va="top",
             fontsize=KEY_SUBTITLE_SIZE, color=PAPER_MUTED)


def save_key_figure(fig, out_path):
    fig.savefig(out_path, dpi=KEY_FIG_DPI, facecolor=PAPER_BG)


def _records_from_parquet(records_path: Path, long_path: Path,
                          extra_cols: list[str]) -> list[dict]:
    """Reconstruct the per-session list-of-dicts that the JSD scripts
    consume, reading directly from the released parquet pair. Each
    record exposes `attack_total`, `attack_success`, the requested
    `extra_cols`, and a `family_table` dict of per-family
    `{selection_rate_pct, asr}` (bias observation) or
    `{attempts, success, selection_rate_pct, asr}` (bias injection)."""
    records = pd.read_parquet(records_path)
    long = pd.read_parquet(long_path)
    long_by_rid = {rid: g for rid, g in long.groupby("record_id")}
    out = []
    for _, r in records.iterrows():
        rid = r["record_id"]
        rec: dict = {
            "record_id":      rid,
            "agent":          r["agent"],
            "target":         r["target"],
            "attack_total":   int(r["attack_total"]),
            "attack_success": int(r["attack_success"]),
        }
        for c in extra_cols:
            rec[c] = r[c]
        family_table: dict = {}
        for _, lr in long_by_rid.get(rid, pd.DataFrame()).iterrows():
            fam = lr["attack_family"]
            if "selection_rate_pct" in lr:
                family_table[fam] = {
                    "selection_rate_pct": float(lr["selection_rate_pct"]),
                    "asr": float(lr["asr"]) if pd.notna(lr["asr"]) else 0.0,
                }
            else:
                attempts = int(lr["attempts"])
                success = int(lr["success"])
                family_table[fam] = {
                    "attempts": attempts,
                    "success":  success,
                    "selection_rate_pct":
                        100.0 * attempts / rec["attack_total"] if rec["attack_total"] else 0.0,
                    "asr":
                        success / attempts if attempts else 0.0,
                }
        rec["family_table"] = family_table
        out.append(rec)
    return out


def load_observation():
    return _records_from_parquet(
        DATA_DIR / "bias_observation_records.parquet",
        DATA_DIR / "bias_observation_family_long.parquet",
        extra_cols=["condition"],
    )


def load_injection():
    return _records_from_parquet(
        DATA_DIR / "bias_injection_records.parquet",
        DATA_DIR / "bias_injection_family_long.parquet",
        extra_cols=["requested_family", "rep"],
    )


def banner(title):
    print()
    print("=" * 78)
    print(f"  {title}")
    print("=" * 78)
