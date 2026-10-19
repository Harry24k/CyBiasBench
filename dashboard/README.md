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

## Updating the release analyses

From the repository root, after installing `pip install -e '.[analysis]'`:

```bash
python scripts/reviewer_revisions.py --output-dir analysis/reviewer_revisions
python scripts/momentum_repro.py --output-dir analysis/momentum
python scripts/agent_identification.py --output-dir analysis/agent_identification
python scripts/temporal_repro.py --output-dir analysis/temporal
python dashboard/scripts/build_site_summary.py
python dashboard/scripts/build_site_summary.py --check
```

The updater verifies the public input hashes and updates ASR estimates,
session-bootstrap intervals, momentum correlations, agent identification, and
temporal adaptation in
`public/data/paper_summary.json`. Other historical fields remain the checked-in
paper snapshot. It does not depend on a private `paper/` tree or regenerate every
legacy metric. See the root [reproduction guide](../HOW_TO_REPRODUCE.md) for
estimators, success-label policy, and interpretation limits.
