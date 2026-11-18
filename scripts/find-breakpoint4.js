const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const widths = [1001, 1005, 1010, 1015, 1020, 1021, 1022, 1023];

  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);

    const isDesktop = await page.evaluate(() => {
      // Desktop nav has actual links visible in the nav bar
      const bodyText = document.body.innerText.substring(0, 200);
      return bodyText.includes('WHAT WE DO') || bodyText.includes('CLIENT LOGIN');
    });

    console.log(`Width ${width}px: ${isDesktop ? 'DESKTOP' : 'mobile'}`);
    await page.close();
  }

  await browser.close();
})();
