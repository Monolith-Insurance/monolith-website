#!/usr/bin/env node
/**
 * screenshot-mobile-compare.js
 * Takes full-page screenshots of live and local at 390px and 768px.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const LIVE  = 'https://www.monolithrisk.com';
const LOCAL = 'http://localhost:8080';
const OUT   = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const viewports = [
  { label: 'mobile', width: 390,  height: 844  },
  { label: 'tablet', width: 768,  height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of viewports) {
    for (const [site, url] of [['live', LIVE], ['local', LOCAL]]) {
      const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, userAgent: UA });
      const page = await ctx.newPage();
      console.log(`Loading ${site} @ ${vp.width}px…`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);
      // scroll to trigger lazy-load
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 300));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
      const file = path.join(OUT, `${site}-${vp.label}-${vp.width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  → ${path.relative(process.cwd(), file)}`);
      await ctx.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
