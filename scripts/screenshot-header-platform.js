const { chromium } = require('playwright');

const WIDTHS = [463, 768];
const SITES = [
  { label: 'live', url: 'https://www.monolithrisk.com' },
  { label: 'local', url: 'http://localhost:8080' },
];

async function scrollLoad(page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= Math.min(document.body.scrollHeight, 6000); y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    for (const site of SITES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width, height: 900 });

      const wait = site.label === 'live' ? 'load' : 'load';
      await page.goto(site.url, { waitUntil: wait, timeout: 30000 });
      await page.waitForTimeout(site.label === 'live' ? 2000 : 1000);
      await scrollLoad(page);

      // Header screenshot — top of page
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `/tmp/fix-${site.label}-${width}-header.png`,
        clip: { x: 0, y: 0, width, height: 120 }
      });
      console.log(`Saved: /tmp/fix-${site.label}-${width}-header.png`);

      // Platform section screenshot
      const platformY = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.textContent.trim() === 'PLATFORM') {
            return node.parentElement.getBoundingClientRect().top + window.scrollY - 40;
          }
        }
        return 3000;
      });
      await page.evaluate(y => window.scrollTo(0, y), platformY);
      await page.waitForTimeout(800); // let iframes settle
      await page.screenshot({
        path: `/tmp/fix-${site.label}-${width}-platform.png`,
        clip: { x: 0, y: 0, width, height: 900 }
      });
      console.log(`Saved: /tmp/fix-${site.label}-${width}-platform.png`);

      await page.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
