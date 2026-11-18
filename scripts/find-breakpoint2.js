const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const widths = [600, 700, 768, 800, 900, 1000, 1024];

  // First, inspect the DOM at 1024px to understand the structure
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Scroll through the page to load lazy sections
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));

  const domInfo = await page.evaluate(() => {
    const body = document.body;
    // Get all text nodes and their containing elements
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
    const hits = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (text.includes('Crop Insurance') || text.includes('Livestock') || text.includes('Farm & Ranch')) {
        const el = node.parentElement;
        const rect = el.getBoundingClientRect();
        hits.push({
          text: text.substring(0, 60),
          tag: el.tagName,
          class: el.className.substring(0, 100),
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        });
      }
    }
    return hits;
  });

  console.log('DOM elements containing card text at 1024px:');
  console.log(JSON.stringify(domInfo, null, 2));

  await page.close();
  await browser.close();
})();
