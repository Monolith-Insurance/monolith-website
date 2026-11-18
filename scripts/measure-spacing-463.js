const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 463, height: 900 });
  await page.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

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
    const px2vw = px => (px / vw * 100).toFixed(2) + 'vw';

    const results = {};

    // Logo size
    const logoImg = document.querySelector('header img, [class*="logo"] img, [class*="Logo"] img');
    const navEl = document.querySelector('header, nav, [role="banner"]');
    if (navEl) {
      const imgs = navEl.querySelectorAll('img, svg');
      imgs.forEach((img, i) => {
        const rect = img.getBoundingClientRect();
        results[`nav-logo-${i}`] = { width: rect.width, height: rect.height, vwW: px2vw(rect.width), vwH: px2vw(rect.height) };
      });
      const navStyle = window.getComputedStyle(navEl);
      results['nav-height'] = { px: navEl.offsetHeight, vw: px2vw(navEl.offsetHeight) };
    }

    // Section padding - measure actual sections by finding elements with significant top/bottom padding
    const sections = document.querySelectorAll('section, [class*="section"]');
    sections.forEach((s, i) => {
      if (i > 8) return;
      const style = window.getComputedStyle(s);
      const pt = parseFloat(style.paddingTop);
      const pb = parseFloat(style.paddingBottom);
      if (pt > 20 || pb > 20) {
        const textSample = (s.innerText || '').substring(0, 40).trim();
        results[`section-${i}-padding`] = {
          paddingTop: pt, ptVw: px2vw(pt),
          paddingBottom: pb, pbVw: px2vw(pb),
          text: textSample
        };
      }
    });

    // Find sections by looking at bounding boxes between section labels
    const sectionLabelTexts = ['MONOLITHIC BY DESIGN', 'WHAT WE DO', 'PLATFORM', 'OUR MISSION', 'OUR VISION', 'WHAT WE STAND FOR', 'CONTACT'];
    for (const text of sectionLabelTexts) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === text) {
          const el = node.parentElement;
          // Walk up to find the section container
          let parent = el;
          for (let i = 0; i < 10; i++) {
            if (!parent.parentElement) break;
            parent = parent.parentElement;
            const style = window.getComputedStyle(parent);
            const pt = parseFloat(style.paddingTop);
            const pb = parseFloat(style.paddingBottom);
            if (pt > 30 || pb > 30) {
              results[`section-${text}-padding`] = {
                paddingTop: pt, ptVw: px2vw(pt),
                paddingBottom: pb, pbVw: px2vw(pb),
                tag: parent.tagName,
                class: parent.className.substring(0, 60)
              };
              break;
            }
          }
          break;
        }
      }
    }

    // Inner container padding (left/right)
    const innerPadding = (() => {
      // Find an element that wraps section content and has left padding
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === 'WHAT WE DO') {
          let el = node.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!el.parentElement) break;
            el = el.parentElement;
            const style = window.getComputedStyle(el);
            const pl = parseFloat(style.paddingLeft);
            if (pl > 10) {
              return { left: pl, vwL: px2vw(pl), right: parseFloat(style.paddingRight), vwR: px2vw(parseFloat(style.paddingRight)), tag: el.tagName, class: el.className.substring(0, 60) };
            }
          }
        }
      }
      return null;
    })();
    if (innerPadding) results['inner-container-padding'] = innerPadding;

    return results;
  });

  console.log('\nSpacing/layout measurements at 463px:');
  console.log('='.repeat(70));
  Object.entries(data).forEach(([k, v]) => {
    console.log(`${k}:`, JSON.stringify(v));
  });

  await browser.close();
})();
