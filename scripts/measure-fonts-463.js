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
  });
  await page.waitForTimeout(1500);

  const measurements = await page.evaluate(() => {
    const vw = 463;
    const results = [];

    function measure(label, el) {
      if (!el) { results.push({ label, px: null, note: 'not found' }); return; }
      const style = window.getComputedStyle(el);
      const px = parseFloat(style.fontSize);
      const vwVal = (px / vw * 100).toFixed(2);
      results.push({ label, px, vw: vwVal, text: (el.innerText || '').substring(0, 60).trim() });
    }

    function findByText(text, maxChildren = 5) {
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

    function findAllByText(text, maxChildren = 5) {
      const results = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim().includes(text)) {
          const el = node.parentElement;
          if (el && el.children.length <= maxChildren) results.push(el);
        }
      }
      return results;
    }

    // Section labels (like "WHAT WE DO", "PLATFORM", "MISSION", etc.)
    const sectionLabels = findAllByText('WHAT WE DO', 2);
    measure('section-label (WHAT WE DO)', sectionLabels[0] || null);

    const missionLabel = findByText('MISSION', 2);
    measure('section-label (MISSION)', missionLabel);

    const visionLabel = findByText('VISION', 2);
    measure('section-label (VISION)', visionLabel);

    const aboutLabel = findByText('ABOUT', 2);
    measure('section-label (ABOUT)', aboutLabel);

    const contactLabel = findByText('CONTACT', 2);
    measure('section-label (CONTACT)', contactLabel);

    // Headings
    const h2s = document.querySelectorAll('h2, h3');
    h2s.forEach((h, i) => {
      if (i < 10) measure(`h2/h3[${i}]`, h);
    });

    // Specific headings by text content
    const riskMgmt = findByText('Risk management, as a practice');
    measure('heading: Risk management (What we do)', riskMgmt);

    const platformHeading = findByText('See everything');
    measure('heading: Platform (See everything)', platformHeading);

    const missionQuote = findByText('Insurance is a promise');
    measure('Mission quote', missionQuote);

    const visionQuote = findByText('independence');
    measure('Vision quote', visionQuote);

    const aboutHeading = findByText('Founded');
    measure('About heading', aboutHeading);

    // Intro paragraphs (body text under headings)
    const paraEls = Array.from(document.querySelectorAll('p')).filter(p => p.innerText && p.innerText.length > 30);
    paraEls.slice(0, 8).forEach((p, i) => measure(`paragraph[${i}]`, p));

    // Card titles (PROGRAM, COMPLIANCE, etc.)
    ['PROGRAM', 'COMPLIANCE', 'ADVISORY', 'DATA'].forEach(title => {
      const el = findByText(title, 1);
      measure(`card-title: ${title}`, el);
    });

    // Card body text
    const cardBody = findByText('Coverage designed around', 3);
    measure('card-body', cardBody);

    // Platform section
    const platformPara = findByText('Real-time data', 5);
    measure('Platform paragraph', platformPara);

    // Contact address
    const address = findByText('8140 Walnut', 3);
    measure('Contact address', address);

    // Footer
    const footer = document.querySelector('footer');
    if (footer) {
      measure('footer text', footer.querySelector('p, span, div'));
    }

    return results;
  });

  console.log('\nFont measurements at 463px:');
  console.log('='.repeat(70));
  measurements.forEach(m => {
    if (m.px) {
      console.log(`${m.label.padEnd(45)} ${String(m.px + 'px').padEnd(8)} → ${m.vw}vw   "${m.text}"`);
    } else {
      console.log(`${m.label.padEnd(45)} NOT FOUND (${m.note})`);
    }
  });

  await browser.close();
})();
