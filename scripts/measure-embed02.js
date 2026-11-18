const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Measure embed-02 natural content height at several widths
  for (const width of [400, 500, 600, 700, 760]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 1200 });
    await page.goto('http://localhost:8080/embeds/embed-02/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    const info = await page.evaluate(() => {
      const wrap = document.querySelector('.wrap');
      const stack = document.querySelector('.stack');
      const shots = document.querySelectorAll('.shot');
      const row = document.querySelector('.row');
      const heights = Array.from(shots).map(s => ({ h: s.offsetHeight, w: s.offsetWidth }));
      return {
        wrapW: wrap?.offsetWidth,
        stackTop: parseInt(window.getComputedStyle(stack).top),
        stackBottom: parseInt(window.getComputedStyle(stack).bottom),
        shots: heights,
        rowH: row?.offsetHeight,
        // Calculate natural total height needed
        totalContentH: stack?.scrollHeight,
      };
    });

    // Natural iframe height = stack.top + stack.scrollHeight + stack.bottom
    const neededH = info.stackTop + info.totalContentH + 28;
    console.log(`Width ${width}: wrapW=${info.wrapW}, needed iframe height=${neededH}, ratio=${(neededH/width).toFixed(4)}`);
    console.log(`  shots:`, info.shots);
    await page.close();
  }

  // Also check what the live site uses for the platform iframe
  const livePage = await browser.newPage();
  await livePage.setViewportSize({ width: 1440, height: 900 });
  await livePage.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
  await livePage.waitForTimeout(2000);
  await livePage.evaluate(async () => {
    for (let y = 0; y <= 5000; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
  });
  const liveInfo = await livePage.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe'));
    return iframes.map(f => ({
      src: f.src?.substring(0, 60),
      w: f.offsetWidth, h: f.offsetHeight,
      rect: { w: Math.round(f.getBoundingClientRect().width), h: Math.round(f.getBoundingClientRect().height) }
    }));
  });
  console.log('\nLive site iframes:', JSON.stringify(liveInfo, null, 2));
  await livePage.close();

  await browser.close();
})();
