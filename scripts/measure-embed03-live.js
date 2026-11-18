const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  for (const width of [393, 463, 768]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll through to trigger lazy loads
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(f => {
        const r = f.getBoundingClientRect();
        return {
          src: f.src ? f.src.substring(0, 80) : '',
          renderedW: Math.round(r.width),
          renderedH: Math.round(r.height),
          attrW: f.getAttribute('width'),
          attrH: f.getAttribute('height'),
        };
      }).filter(f => f.renderedW > 0);
    });

    console.log(`\n=== Live site @ ${width}px ===`);
    iframes.forEach(f => {
      const ratio = (f.renderedH / f.renderedW).toFixed(4);
      console.log(`  src: ${f.src}`);
      console.log(`  rendered: ${f.renderedW} × ${f.renderedH}  ratio h/w=${ratio}  attrs: width=${f.attrW} height=${f.attrH}`);
    });
    await page.close();
  }

  await browser.close();
})();
