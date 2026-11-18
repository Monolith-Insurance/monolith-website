const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 463, height: 900 });
  await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Scroll through to trigger lazy loading
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const vw = 463;

    function px2vw(px) { return (px / vw * 100).toFixed(2) + 'vw'; }

    // Get all text nodes with their font sizes - exhaustive
    const results = [];
    const seen = new Set();
    const all = document.querySelectorAll('*');

    for (const el of all) {
      const text = (el.innerText || '').trim();
      if (!text || text.length < 3 || text.length > 200) continue;
      if (el.children.length > 2) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < 5) continue;

      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 8) continue;

      const key = `${fontSize}:${text.substring(0, 20)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        tag: el.tagName,
        text: text.substring(0, 80),
        fontSize,
        vw: px2vw(fontSize),
        y: Math.round(rect.top + window.scrollY)
      });
    }

    // Sort by y position to show in page order
    results.sort((a, b) => a.y - b.y);
    return results;
  });

  console.log(`\nAll text elements at 463px (sorted by page position):`);
  console.log('='.repeat(90));
  data.forEach(d => {
    console.log(`y=${String(d.y).padStart(5)}  ${String(d.fontSize+'px').padEnd(8)} → ${String(d.vw).padEnd(10)}  [${d.tag}] "${d.text}"`);
  });

  await browser.close();
})();
