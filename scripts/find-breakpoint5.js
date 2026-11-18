const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Confirm 1024 is desktop, capture What We Do section at 1000 and 1024
  for (const width of [1000, 1024]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll down to trigger lazy loading of sections
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
    });
    await page.waitForTimeout(1000);

    // Find the What We Do section and scroll to it
    const sectionY = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        if (el.innerText && el.innerText.trim() === 'WHAT WE DO' && el.offsetHeight < 100) {
          return el.getBoundingClientRect().top + window.scrollY;
        }
      }
      return 1500; // fallback
    });

    await page.evaluate((y) => window.scrollTo(0, y - 100), sectionY);
    await page.waitForTimeout(500);

    await page.screenshot({ path: `/tmp/wix-whatwedo-${width}.png`, clip: { x: 0, y: 0, width, height: 900 } });
    console.log(`Screenshot saved: /tmp/wix-whatwedo-${width}.png (section at y=${sectionY})`);
    await page.close();
  }

  await browser.close();
})();
