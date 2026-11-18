const { chromium } = require('playwright');

const WIDTHS = [393, 463, 768];
const SITES = [
  { label: 'local', url: 'http://localhost:8080' },
  { label: 'live',  url: 'https://www.monolithrisk.com' },
];

async function scrollLoad(page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= Math.min(document.body.scrollHeight, 8000); y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    for (const site of SITES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width, height: 900 });

      const waitTimeout = site.label === 'live' ? 2500 : 800;
      await page.goto(site.url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(waitTimeout);
      await scrollLoad(page);

      // Find the map iframe (local: .platform-map iframe; live: tallest portrait iframe)
      const mapInfo = await page.evaluate(() => {
        // Try local selector first
        let iframe = document.querySelector('.platform-map iframe');
        // Fallback: find the tallest portrait (h > w) iframe with significant size
        if (!iframe) {
          const all = Array.from(document.querySelectorAll('iframe'));
          let best = null, bestH = 0;
          for (const f of all) {
            const r = f.getBoundingClientRect();
            if (r.width > 50 && r.height > r.width && r.height > bestH) {
              best = f;
              bestH = r.height;
            }
          }
          iframe = best;
        }
        if (!iframe) return null;
        const r = iframe.getBoundingClientRect();
        return {
          scrollTop: r.top + window.scrollY - 60,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });

      if (!mapInfo) {
        console.log(`${site.label} @ ${width}px: no embed-03 iframe found`);
        await page.close();
        continue;
      }

      const ratio = (mapInfo.h / mapInfo.w).toFixed(4);
      console.log(`${site.label} @ ${width}px: iframe ${mapInfo.w}×${mapInfo.h} (h/w=${ratio})`);

      await page.evaluate(y => window.scrollTo(0, y), mapInfo.scrollTop);
      await page.waitForTimeout(1200); // let MapLibre + iframe render

      await page.screenshot({
        path: `/tmp/map-compare-${site.label}-${width}.png`,
        clip: { x: 0, y: 0, width, height: 900 },
      });
      console.log(`  Saved: /tmp/map-compare-${site.label}-${width}.png`);

      await page.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
