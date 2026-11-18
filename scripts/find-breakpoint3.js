const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const widths = [600, 700, 768, 800, 900, 1000, 1024];

  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll down to trigger lazy loading
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

    // Find the "What We Do" section and take a screenshot of it
    // Also check page structure for any element with side-by-side items
    const info = await page.evaluate(() => {
      // Get all elements and find ones that look like cards in a row
      const sections = Array.from(document.querySelectorAll('[data-testid], section, [class*="section"], [class*="Section"]'));

      // Check the full page text to see if Wix uses different text
      const bodyText = document.body.innerText.substring(0, 500);

      // Try to find the cards by looking for a grid/flex container
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return (style.display === 'flex' || style.display === 'grid') && el.children.length >= 3;
      });

      return {
        bodyTextSample: bodyText,
        containerCount: containers.length,
        // Get the first few containers and their children positions
        containerSamples: containers.slice(0, 5).map(c => ({
          tag: c.tagName,
          class: c.className.substring(0, 80),
          display: window.getComputedStyle(c).display,
          childCount: c.children.length,
          rect: { left: Math.round(c.getBoundingClientRect().left), top: Math.round(c.getBoundingClientRect().top), width: Math.round(c.getBoundingClientRect().width) }
        }))
      };
    });

    console.log(`\n--- Width ${width}px ---`);
    console.log('Body text sample:', info.bodyTextSample.replace(/\n/g, ' ').substring(0, 100));

    await page.screenshot({ path: `/tmp/wix-${width}.png`, fullPage: false });
    console.log(`Screenshot saved to /tmp/wix-${width}.png`);

    await page.close();
  }

  await browser.close();
  console.log('\nDone! Check screenshots at /tmp/wix-*.png');
})();
