#!/usr/bin/env node
/**
 * Generate public/og-radar.png — alternate OG layout with five mini radars
 * (one per agent) instead of the four stat cards.
 *
 * Pulls real Selᵢ data from public/data/paper_summary.json and renders each
 * agent's 10-family selection vector as a polygon over a 10-axis web. The
 * five distinctly-shaped polygons are the visual hook: "same task, five
 * different attack signatures."
 *
 * Usage:
 *   node scripts/generate-og-radar.mjs
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const summary = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/paper_summary.json"), "utf8"),
);
const agents = summary.agents; // ["claude","codex","gemini","kimi","glm"]
const families = summary.families;
const sel = summary.fig3_selection_per_agent;
const asr = summary.fig3_asri_per_agent;

const AGENT_LABELS = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
  kimi: "Kimi",
  glm: "GLM",
};
// Brand colors (match lib/types.ts MODEL_COLORS).
const AGENT_COLORS = {
  claude: "#D97757",
  codex: "#10A37F",
  gemini: "#4285F4",
  kimi: "#DC2626",
  glm: "#8B5CF6",
};

const N = families.length; // 10
const maxSel = Math.max(
  ...agents.flatMap((a) => families.map((f) => sel[a]?.[f] ?? 0)),
);
const maxAsr = Math.max(
  ...agents.flatMap((a) => families.map((f) => asr[a]?.[f] ?? 0)),
);

function polygonPoints(values, max, cx, cy, r) {
  return values
    .map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const norm = max > 0 ? v / max : 0;
      const x = cx + r * Math.cos(angle) * norm;
      const y = cy + r * Math.sin(angle) * norm;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function axisLines(cx, cy, r) {
  return Array.from({ length: N }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#d4d4d8" stroke-width="0.6" />`;
  }).join("");
}

function radarSvg(agent, size = 210, r = 88) {
  const cx = size / 2;
  const cy = size / 2;
  const color = AGENT_COLORS[agent];
  const selValues = families.map((f) => sel[agent]?.[f] ?? 0);
  const asrValues = families.map((f) => asr[agent]?.[f] ?? 0);
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e4e4e7" stroke-width="1" />
      <circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="#e4e4e7" stroke-width="0.6" />
      <circle cx="${cx}" cy="${cy}" r="${r * 0.33}" fill="none" stroke="#e4e4e7" stroke-width="0.6" />
      ${axisLines(cx, cy, r)}
      <!-- Sel_i: filled polygon (allocation / preference) -->
      <polygon points="${polygonPoints(selValues, maxSel, cx, cy, r)}" fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="2" stroke-linejoin="round" />
      <!-- ASR_i: dashed outline with light gray fill (capability / outcome) -->
      <polygon points="${polygonPoints(asrValues, maxAsr, cx, cy, r)}" fill="#52525b" fill-opacity="0.12" stroke="#52525b" stroke-width="1.4" stroke-dasharray="3 2.5" stroke-linejoin="round" />
    </svg>
  `;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      padding: 40px 72px;
      background:
        radial-gradient(ellipse at 12% 0%, rgba(99, 102, 241, 0.10) 0%, transparent 55%),
        radial-gradient(ellipse at 88% 100%, rgba(244, 63, 94, 0.08) 0%, transparent 55%),
        linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      color: #18181b;
      display: flex;
      flex-direction: column;
    }
    .top {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    h1 {
      font-family: "DM Serif Display", "Times New Roman", serif;
      font-size: 110px;
      line-height: 0.95;
      margin: 0;
      letter-spacing: -0.025em;
      background: linear-gradient(180deg, #18181b 0%, #3f3f46 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      font-size: 30px;
      color: #52525b;
      letter-spacing: -0.005em;
      max-width: 920px;
    }
    .punchline {
      font-size: 22px;
      color: #27272a;
      max-width: 920px;
      line-height: 1.35;
    }
    .punchline strong { color: #09090b; font-weight: 700; }
    .radars {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      align-items: end;
      margin-top: 36px;
    }
    .radar-card {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .radar-card svg {
      display: block;
    }
    .agent-name {
      font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-top: 12px;
    }
    .meta {
      font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
      font-size: 13px;
      letter-spacing: 0.06em;
      color: #71717a;
      text-transform: uppercase;
      text-align: center;
      margin-top: 36px;
    }
  </style>
</head>
<body>
  <div class="top">
    <h1>CyBiasBench</h1>
    <div class="subtitle">Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios</div>
    <div class="punchline">
      <strong>Same target, same task — five different attack signatures.</strong>
      Filled = what each agent <em>picks</em> (Selᵢ), dashed = what actually <em>works</em> (ASRᵢ). The shapes don't match.
    </div>
  </div>
  <div>
    <div class="radars">
      ${agents
        .map(
          (a) => `
        <div class="radar-card">
          ${radarSvg(a)}
          <div class="agent-name" style="color: ${AGENT_COLORS[a]}">${AGENT_LABELS[a]}</div>
        </div>`,
        )
        .join("")}
    </div>
    <div class="meta">5 agents &middot; 3 targets &middot; 4 prompt conditions &middot; 630 sessions</div>
  </div>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(HTML, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const out = path.join(ROOT, "public", "og-radar.png");
    await page.screenshot({
      path: out,
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 630 },
      omitBackground: false,
    });
    console.log(`✓ wrote ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
