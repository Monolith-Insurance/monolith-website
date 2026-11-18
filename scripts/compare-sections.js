const { chromium } = require('playwright');
const path = require('path');

const SECTIONS = [
  { name: 'what-we-do', label: 'WHAT WE DO' },
  { name: 'mission',    label: 'OUR MISSION' },
  { name: 'vision',     label: 'OUR VISION' },
  { name: 'stand-for',  label: 'WHAT WE STAND FOR' },
  { name: 'contact',    label: 'CONTACT' },
];

async function screenshotSections(page, width, siteLabel) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  for (const section of SECTIONS) {
    // Find element with the label text
    const y = await page.evaluate((label) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === label) {
          const el = node.parentElement;
          const rect = el.getBoundingClientRect();
          return rect.top + window.scrollY - 40;
        }
      }
      return -1;
    }, section.label);

    if (y < 0) {
      console.log(`  [skip] ${section.name}: label "${section.label}" not found`);
      continue;
    }

    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(300);

    const filename = `/tmp/cmp-${siteLabel}-${width}-${section.name}.png`;
    await page.screenshot({ path: filename, clip: { x: 0, y: 0, width, height: 900 } });
    console.log(`  Saved: ${filename}`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const widths = [463, 768];

  for (const width of widths) {
    console.log(`\n=== Width: ${width}px ===`);

    // Live site
    console.log('--- Live site (monolithrisk.com) ---');
    const livePage = await browser.newPage();
    await livePage.setViewportSize({ width, height: 900 });
    await livePage.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await livePage.waitForTimeout(2000);
    await screenshotSections(livePage, width, 'live');
    await livePage.close();

    // Local site
    console.log('--- Local site (localhost:8080) ---');
    const localPage = await browser.newPage();
    await localPage.setViewportSize({ width, height: 900 });
    await localPage.goto('http://localhost:8080', { waitUntil: 'load', timeout: 15000 });
    await localPage.waitForTimeout(1500);
    await screenshotSections(localPage, width, 'local');
    await localPage.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots in /tmp/cmp-*.png');
})();
