const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const widths = [600, 700, 768, 800, 900, 1000, 1024];

  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check if "What We Do" cards are side by side by measuring card positions
    const result = await page.evaluate(() => {
      // Find cards in the What We Do section
      const allElements = document.querySelectorAll('*');
      let cards = [];

      // Try to find the cards by looking for elements that contain card-like text
      for (const el of allElements) {
        const text = el.innerText || '';
        if ((text.includes('Crop Insurance') || text.includes('Livestock') || text.includes('Farm & Ranch')) &&
            el.children.length <= 3 && el.offsetHeight > 50 && el.offsetHeight < 400) {
          cards.push({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, width: el.offsetWidth, height: el.offsetHeight, tag: el.tagName, class: el.className });
        }
      }

      // Also try a simpler approach: find elements with similar vertical positions
      return cards;
    });

    // Check if any cards are side-by-side (similar top position, different left positions)
    let sideBySide = false;
    if (result.length >= 2) {
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          if (Math.abs(result[i].top - result[j].top) < 30 && Math.abs(result[i].left - result[j].left) > 50) {
            sideBySide = true;
          }
        }
      }
    }

    console.log(`Width ${width}px: cards side-by-side = ${sideBySide}, found ${result.length} card-like elements`);
    if (result.length > 0) {
      result.slice(0, 4).forEach((c, i) => console.log(`  card ${i}: left=${Math.round(c.left)}, top=${Math.round(c.top)}, w=${c.width}, h=${c.height}`));
    }

    await page.close();
  }

  await browser.close();
})();
