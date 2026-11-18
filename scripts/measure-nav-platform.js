const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  for (const width of [463, 768]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
      const nav = document.querySelector('header, nav, [role="banner"]');
      const logos = nav ? nav.querySelectorAll('svg, img') : [];
      const logoArr = Array.from(logos).map(el => ({
        tag: el.tagName,
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      })).filter(el => el.w > 0);
      return {
        navH: nav?.offsetHeight,
        logos: logoArr,
      };
    });
    console.log(`Live site @ ${width}px: nav height=${info.navH}px (${(info.navH/width*100).toFixed(2)}vw), logos=${JSON.stringify(info.logos)}`);

    await page.close();
  }

  // Also check local
  for (const width of [463, 768]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:8080', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const nav = document.querySelector('#nav');
      const logoSvg = nav?.querySelector('.nav-logo svg');
      return {
        navH: nav?.offsetHeight,
        logoW: logoSvg?.getBoundingClientRect().width,
        logoH: logoSvg?.getBoundingClientRect().height,
      };
    });
    console.log(`Local site @ ${width}px: nav height=${info.navH}px, logo=${Math.round(info.logoW)}×${Math.round(info.logoH)}px`);
    await page.close();
  }

  await browser.close();
})();
