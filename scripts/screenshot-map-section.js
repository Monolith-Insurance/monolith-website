const { chromium } = require('playwright');

const WIDTHS = [393, 463, 768, 1440];

(async () => {
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:8080', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);

    // Scroll to load lazy iframes
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    // Find .platform-map iframe bounding rect
    const iframeRect = await page.evaluate(() => {
      const iframe = document.querySelector('.platform-map iframe');
      if (!iframe) return null;
      const r = iframe.getBoundingClientRect();
      return { top: r.top + window.scrollY, left: r.left, width: Math.round(r.width), height: Math.round(r.height) };
    });

    if (!iframeRect) {
      console.log(`w=${width}: no .platform-map iframe found`);
      await page.close();
      continue;
    }

    // Scroll so the whole map section is visible (a bit above)
    const scrollY = Math.max(0, iframeRect.top - 60);
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(1000); // let iframe render

    // Log rendered dimensions
    const renderedRect = await page.evaluate(() => {
      const iframe = document.querySelector('.platform-map iframe');
      const r = iframe.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    const ratio = (renderedRect.h / renderedRect.w).toFixed(4);
    console.log(`w=${width}: iframe rendered ${renderedRect.w}×${renderedRect.h} (h/w=${ratio})`);

    // Screenshot: enough height to show the whole iframe
    const clipH = Math.min(renderedRect.h + 80, 900);
    await page.screenshot({
      path: `/tmp/map-${width}.png`,
      clip: { x: 0, y: 0, width, height: clipH }
    });
    console.log(`  Saved: /tmp/map-${width}.png`);

    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
