#!/usr/bin/env node
/**
 * screenshot-463-compare.js
 * Section-by-section screenshots at 463px: local vs live.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const LIVE  = 'https://www.monolithrisk.com';
const LOCAL = 'http://localhost:8080';
const OUT   = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Local sections by id; live uses text-based lookup
const localSections = [
  { label: 'built',        sel: '#built'        },
  { label: 'wwd',          sel: '#what-we-do'   },
  { label: 'platform',     sel: '#platform'     },
  { label: 'mission',      sel: '#mission'      },
  { label: 'vision-about', sel: '#vision-about' },
  { label: 'standfor',     sel: '#stand-for'    },
  { label: 'contact',      sel: '#contact'      },
];

// For the live Wix site, find sections by looking for heading text
const liveSectionTexts = [
  { label: 'built',        text: 'Built to hold'           },
  { label: 'wwd',          text: 'Risk management'         },
  { label: 'platform',     text: 'PLATFORM'                },
  { label: 'mission',      text: 'MISSION'                 },
  { label: 'vision-about', text: 'OUR VISION'              },
  { label: 'standfor',     text: 'WHAT WE STAND FOR'       },
  { label: 'contact',      text: 'Talk to us'              },
];

async function findSectionByText(page, text) {
  return page.evaluateHandle((searchText) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().includes(searchText)) {
        // Walk up to find a reasonable block ancestor
        let el = node.parentElement;
        while (el && el !== document.body) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 100 && rect.width > 300) return el;
          el = el.parentElement;
        }
      }
    }
    return null;
  }, text);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Local — screenshot each section element
  {
    const ctx  = await browser.newContext({ viewport: { width: 463, height: 900 }, userAgent: UA });
    const page = await ctx.newPage();
    console.log('Loading local @ 463px…');
    await page.goto(LOCAL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1500);
    for (const { label, sel } of localSections) {
      const el = await page.$(sel);
      if (!el) { console.log(`  MISSING ${sel}`); continue; }
      const file = path.join(OUT, `local-463-${label}.png`);
      await el.screenshot({ path: file });
      console.log(`  -> ${path.relative(process.cwd(), file)}`);
    }
    await ctx.close();
  }

  // Live — full-page screenshot (Wix structure differs)
  {
    const ctx  = await browser.newContext({ viewport: { width: 463, height: 900 }, userAgent: UA });
    const page = await ctx.newPage();
    console.log('Loading live @ 463px…');
    await page.goto(LIVE, { waitUntil: 'load', timeout: 60000 });
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
    const file = path.join(OUT, 'live-463-full.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  -> ${path.relative(process.cwd(), file)}`);
    await ctx.close();
  }

  await browser.close();
  console.log('Done.');
})();
