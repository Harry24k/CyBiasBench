# CyBiasBench dashboard

Interactive results for *CyBiasBench: Benchmarking Bias in LLM Agents for
Cyber-Attack Scenarios*.

From this directory:

```bash
npm ci
NEXT_PUBLIC_DEPLOY_TARGET=github npm run dev
npm run lint
NEXT_PUBLIC_DEPLOY_TARGET=github npm run build
```

The production build exports `out/` for the `/CyBiasBench/` base path. The root
GitHub Actions workflow builds this directory and publishes it to GitHub Pages.
The legacy anonymous Vercel mode remains until its redirect is deployed.

## Rebuilding every dashboard statistic

From the repository root, after installing `pip install -e '.[analysis]'`:

```bash
python dashboard/scripts/build_site_summary.py
# Recompute and compare without overwriting the summary:
python dashboard/scripts/build_site_summary.py --check
# Fast estimator edge-case tests:
python -m unittest discover -s dashboard/scripts/tests -v
```

The builder calculates every field in `public/data/paper_summary.json` directly
from five public CSVs under `data/`. It works when the output file and all
`analysis/` results are absent, and does not use a private `paper/` directory.
It includes selection/diversity, prompt and target JSD, correlations, token
costs, ASR bootstrap intervals, random-forest identification, and temporal
adaptation. Expect a few minutes for the 500-tree leave-one-out classifier.
No experiments, model calls, plots, or network requests are made.

Use `--data-dir PATH` to select the public CSV directory and `--summary PATH`
to write a separate JSON file. `--check` compares all fields, allowing only
floating-point roundoff (absolute and relative tolerance `1e-12`); it never
writes. The summary records input SHA-256 hashes, method metadata, and the
scikit-learn version. See [the reproduction guide](../HOW_TO_REPRODUCE.md#dashboard-release-statistics)
for the tested environment and exact aggregation conventions.
