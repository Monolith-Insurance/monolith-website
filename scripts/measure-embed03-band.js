const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Measure band + wrap heights at different widths (simulating iframe widths)
  for (const width of [300, 361, 400, 431, 500, 600, 700, 736, 800]) {
    const page = await browser.newPage();
    // Set a very large height so nothing clips
    await page.setViewportSize({ width, height: 2000 });
    await page.goto('http://localhost:8080/embeds/embed-03/index.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      // Find col, wrap, band
      const body = document.body;
      const col = body.firstElementChild;
      if (!col) return { error: 'no col' };
      const children = Array.from(col.children);
      const wrap = children[0];
      const band = children[1];
      return {
        colH: col?.offsetHeight,
        wrapH: wrap?.offsetHeight,
        bandH: band?.offsetHeight,
        bandStyle: band ? window.getComputedStyle(band).height : null,
        innerW: window.innerWidth,
        mobMode: window.innerWidth < 600,
      };
    });

    const totalNeeded = (info.wrapH || 420) + (info.bandH || 118);
    console.log(`iframe w=${width}: col=${info.colH}, wrap=${info.wrapH}, band=${info.bandH} (style:${info.bandStyle}), total_needed=${totalNeeded}, mobile=${info.mobMode}`);
    await page.close();
  }

  await browser.close();
})();
