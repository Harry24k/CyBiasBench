#!/usr/bin/env node
/**
 * Generate public/og.png — the social-share preview image.
 *
 * Renders a self-contained HTML layout (CyBiasBench branding + the four
 * headline stats from the hero) at 1200×630 via puppeteer-core, then
 * screenshots it into public/og.png. Intentionally carries NO author names
 * and NO venue keywords so it is safe to ship on both the Vercel review URL
 * and the Harry24k GitHub Pages site without further post-processing.
 *
 * Usage:
 *   node scripts/generate-og.mjs
 *   CHROME_PATH=/path/to/chromium node scripts/generate-og.mjs
 */

import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CHROME_PATH =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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
      padding: 64px 72px;
      background:
        radial-gradient(ellipse at 12% 0%, rgba(99, 102, 241, 0.10) 0%, transparent 55%),
        radial-gradient(ellipse at 88% 100%, rgba(244, 63, 94, 0.08) 0%, transparent 55%),
        linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      color: #18181b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .top {
      display: flex;
      flex-direction: column;
      gap: 16px;
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
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-top: 24px;
    }
    .stat {
      border: 1px solid #e4e4e7;
      border-radius: 14px;
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(4px);
    }
    .stat-eyebrow {
      font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-eyebrow.bias { color: #6366f1; }
    .stat-eyebrow.perf { color: #10b981; }
    .stat-eyebrow.inj  { color: #f43f5e; }
    .stat-value {
      font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
      font-size: 38px;
      font-weight: 600;
      margin-top: 2px;
      line-height: 1;
      color: #18181b;
      font-variant-numeric: tabular-nums;
    }
    .stat-caption {
      font-size: 12px;
      color: #71717a;
      margin-top: 8px;
      line-height: 1.3;
    }
    .meta {
      font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
      font-size: 13px;
      letter-spacing: 0.06em;
      color: #71717a;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="top">
    <h1>CyBiasBench</h1>
    <div class="subtitle">Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios</div>
    <div class="punchline">
      <strong>Same target, same task — but each agent reaches for a different attack.</strong>
      Forcing an agent off its preference <strong>drops</strong> attack success, not raises it.
    </div>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-eyebrow bias">η²(H)</div>
      <div class="stat-value">0.43</div>
      <div class="stat-caption">agent identity on attack-family entropy</div>
    </div>
    <div class="stat">
      <div class="stat-eyebrow perf">η²(ASR)</div>
      <div class="stat-value">0.05</div>
      <div class="stat-caption">agent identity on session ASR</div>
    </div>
    <div class="stat">
      <div class="stat-eyebrow perf">ρ transfer</div>
      <div class="stat-value">+0.70</div>
      <div class="stat-caption">per-family ASR carries across settings</div>
    </div>
    <div class="stat">
      <div class="stat-eyebrow inj">ΔASR</div>
      <div class="stat-value">≤ 0</div>
      <div class="stat-caption">all 5 agents under explicit steering</div>
    </div>
  </div>
  <div class="meta">5 agents &middot; 3 targets &middot; 4 prompt conditions &middot; 630 sessions</div>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(HTML, { waitUntil: "networkidle0", timeout: 30000 });
    // Extra wait so webfonts paint before screenshot.
    await new Promise((r) => setTimeout(r, 1500));
    const out = path.join(ROOT, "public", "og.png");
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
