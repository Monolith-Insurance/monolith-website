const { chromium } = require('playwright');

// Check that at the actual rendered iframe sizes, the band (stats bar) is visible and not clipped
(async () => {
  const browser = await chromium.launch();

  for (const viewportW of [393, 463, 768]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: viewportW, height: 2000 });
    // Open embed-03 directly at the actual iframe width (viewport - 32px side padding)
    const iframeW = viewportW - 32;
    await page.setViewportSize({ width: iframeW, height: 2000 });
    await page.goto('http://localhost:8080/embeds/embed-03/index.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const col = document.body.firstElementChild;
      if (!col) return { error: 'no col' };
      const wrap = col.children[0];
      const band = col.children[1];
      // Check if all 5 stat items are visible (not clipped)
      const statItems = band ? Array.from(band.querySelectorAll('div')).filter(d => d.children.length === 0 && d.textContent.trim().length > 0) : [];
      const bandRect = band ? band.getBoundingClientRect() : null;
      const colRect = col ? col.getBoundingClientRect() : null;
      return {
        innerW: window.innerWidth,
        colH: col.offsetHeight,
        wrapH: wrap ? wrap.offsetHeight : 0,
        bandH: band ? band.offsetHeight : 0,
        bandBottom: bandRect ? Math.round(bandRect.bottom) : 0,
        colBottom: colRect ? Math.round(colRect.bottom) : 0,
        mobMode: window.innerWidth < 600,
      };
    });

    const iframeH = info.colH; // what height the iframe needs to show everything
    const margin = info.colBottom - info.bandBottom;
    console.log(`viewport=${viewportW} → iframe_w=${iframeW}: col=${info.colH}, wrap=${info.wrapH}, band=${info.bandH}, band_bottom=${info.bandBottom}, col_bottom=${info.colBottom}, mobile=${info.mobMode}`);
    console.log(`  Stats bar fully inside col: ${info.bandBottom <= info.colBottom ? '✓' : '✗ CLIPPED'}`);

    await page.close();
  }

  await browser.close();
})();
