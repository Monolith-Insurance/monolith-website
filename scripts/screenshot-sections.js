#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OUT = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  { label: 'built-390',    sel: '#built',      width: 390 },
  { label: 'wwd-390',      sel: '#what-we-do', width: 390 },
  { label: 'platform-390', sel: '#platform',   width: 390 },
  { label: 'standfor-390', sel: '#stand-for',  width: 390 },
  { label: 'contact-390',  sel: '#contact',    width: 390 },
  { label: 'footer-390',   sel: '#footer',     width: 390 },
  { label: 'built-768',    sel: '#built',      width: 768 },
  { label: 'standfor-768', sel: '#stand-for',  width: 768 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const { label, sel, width } of jobs) {
    for (const [site, url] of [['live', 'https://www.monolithrisk.com'], ['local', 'http://localhost:8080']]) {
      const ctx  = await browser.newContext({ viewport: { width, height: 900 }, userAgent: UA });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(1500);
      const el = await page.$(sel);
      if (!el) { console.log('MISSING', sel, url); await ctx.close(); continue; }
      const file = path.join(OUT, site + '-' + label + '.png');
      await el.screenshot({ path: file });
      console.log('  ->', path.relative(process.cwd(), file));
      await ctx.close();
    }
  }
  await browser.close();
  console.log('Done.');
})();
