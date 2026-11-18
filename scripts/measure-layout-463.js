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

  const measurements = await page.evaluate(() => {
    const vw = 463;
    const results = [];

    function findByText(text, maxChildren = 10) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim().includes(text)) {
          const el = node.parentElement;
          if (el && el.children.length <= maxChildren) return el;
        }
      }
      return null;
    }

    function measureEl(label, el) {
      if (!el) { results.push({ label, note: 'not found' }); return; }
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      results.push({
        label,
        fontSize: parseFloat(style.fontSize),
        fontSizeVw: (parseFloat(style.fontSize) / vw * 100).toFixed(2),
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        text: (el.innerText || '').substring(0, 60).trim()
      });
    }

    // Logo
    const logo = document.querySelector('img[alt*="onolith"], img[src*="logo"], header img');
    measureEl('logo img', logo);

    // Nav links
    const navLink = document.querySelector('nav a, header a');
    measureEl('nav link', navLink);

    // Find section containers by their content
    // Built to Hold section
    const builtToHoldSection = findByText('Built to hold.', 10);
    if (builtToHoldSection) {
      let parent = builtToHoldSection;
      for (let i = 0; i < 5; i++) {
        if (parent.parentElement) parent = parent.parentElement;
        const style = window.getComputedStyle(parent);
        if (parseFloat(style.paddingTop) > 20 || parseFloat(style.paddingBottom) > 20) {
          measureEl('Built-to-Hold section padding', parent);
          break;
        }
      }
    }

    // What We Do heading
    const whatWeDoH = findByText('Risk management, as a practice');
    measureEl('What We Do heading', whatWeDoH);

    // What We Do intro para
    const introEl = findByText('Monolith runs the complete risk program');
    measureEl('What We Do intro para', introEl);

    // Card icon size
    const svgIcons = document.querySelectorAll('svg');
    svgIcons.forEach((svg, i) => {
      if (i < 6) {
        const rect = svg.getBoundingClientRect();
        if (rect.width > 10 && rect.width < 200) {
          results.push({ label: `svg[${i}]`, width: Math.round(rect.width), height: Math.round(rect.height), vwW: (rect.width/vw*100).toFixed(1) });
        }
      }
    });

    // All headings for Mission/Vision/Contact sections
    const allH = document.querySelectorAll('h1, h2, h3, h4');
    allH.forEach((h, i) => {
      measureEl(`heading[${i}]: ${(h.innerText||'').substring(0,30)}`, h);
    });

    // Section eyebrow labels
    const eyebrows = Array.from(document.querySelectorAll('p, span, div')).filter(el => {
      const text = (el.innerText || '').trim();
      return ['OUR MISSION', 'OUR VISION', 'ABOUT', 'WHAT WE DO', 'PLATFORM'].includes(text);
    });
    eyebrows.forEach(el => {
      const style = window.getComputedStyle(el);
      results.push({
        label: `eyebrow: "${(el.innerText||'').trim()}"`,
        fontSize: parseFloat(style.fontSize),
        fontSizeVw: (parseFloat(style.fontSize)/vw*100).toFixed(2),
        letterSpacing: style.letterSpacing
      });
    });

    return results;
  });

  console.log('\nLayout measurements at 463px:');
  console.log('='.repeat(80));
  measurements.forEach(m => {
    if (m.note) {
      console.log(`${m.label}: NOT FOUND`);
    } else if (m.fontSize) {
      console.log(`${m.label}: ${m.fontSize}px → ${m.fontSizeVw}vw  "${m.text || ''}"`);
      if (m.paddingTop !== '0px') console.log(`  padding: ${m.paddingTop} ${m.paddingRight} ${m.paddingBottom} ${m.paddingLeft}`);
    } else {
      console.log(`${m.label}: ${JSON.stringify(m)}`);
    }
  });

  await browser.close();
})();
