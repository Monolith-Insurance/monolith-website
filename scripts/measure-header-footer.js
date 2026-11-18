// Measure header and footer elements on live site and localhost
// Usage: node scripts/measure-header-footer.js
// Requires: localhost:8080 to be running

const { chromium } = require('playwright');

const VIEWPORT = { width: 1440, height: 900 };

async function measure(page, label) {
  const data = await page.evaluate(() => {
    function cs(el, prop) {
      return getComputedStyle(el).getPropertyValue(prop).trim();
    }
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) };
    }

    const results = {};

    // ---- HEADER ----
    const header = document.querySelector('header') || document.querySelector('nav') || document.querySelector('.header') || document.querySelector('[class*="header"]');
    if (header) {
      results.headerHeight = Math.round(header.getBoundingClientRect().height);
      results.headerPaddingTop = cs(header, 'padding-top');
      results.headerPaddingBottom = cs(header, 'padding-bottom');
    }

    // Logo in header
    const headerLogo = document.querySelector('header img, header svg, header .logo, nav img, nav svg, nav .logo, [class*="header"] img, [class*="header"] svg');
    if (headerLogo) {
      const r = rect(headerLogo);
      results.logoWidth = r.width;
      results.logoHeight = r.height;
      results.logoLeft = r.left;
    }

    // Nav links in header
    const navLinks = Array.from(document.querySelectorAll('header nav a, header a[href], nav > ul > li > a, nav > a, .nav a, [class*="header"] nav a, [class*="nav"] a')).filter(a => {
      const text = a.textContent.trim();
      return text.length > 0 && text.length < 50 && !a.querySelector('img') && !a.querySelector('svg');
    });

    if (navLinks.length > 0) {
      const link = navLinks[0];
      results.navLinkFontSize = cs(link, 'font-size');
      results.navLinkLetterSpacing = cs(link, 'letter-spacing');
      results.navLinkFontWeight = cs(link, 'font-weight');
      results.navLinkTexts = navLinks.slice(0, 6).map(a => a.textContent.trim());
      results.navLinkFirstClass = link.className || link.parentElement?.className || '(none)';
      results.navLinkFirstTag = link.closest('[class]')?.className?.slice(0, 60) || '(none)';
      // getBoundingClientRect height reveals the TRUE visual rendered height (transform-aware)
      results.navLinkVisualHeight = Math.round(link.getBoundingClientRect().height);

      if (navLinks.length >= 2) {
        const r1 = navLinks[0].getBoundingClientRect();
        const r2 = navLinks[1].getBoundingClientRect();
        results.navLinkGap = Math.round(r2.left - r1.right);
      }
    }

    // Client Login button
    const loginBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
      const t = el.textContent.trim().toLowerCase();
      return t.includes('client login') || t.includes('login') || t.includes('log in');
    });
    if (loginBtn) {
      const r = rect(loginBtn);
      results.loginBtnFontSize = cs(loginBtn, 'font-size');
      results.loginBtnPaddingTop = cs(loginBtn, 'padding-top');
      results.loginBtnPaddingBottom = cs(loginBtn, 'padding-bottom');
      results.loginBtnPaddingLeft = cs(loginBtn, 'padding-left');
      results.loginBtnPaddingRight = cs(loginBtn, 'padding-right');
      results.loginBtnWidth = r.width;
      results.loginBtnHeight = r.height;
      results.loginBtnText = loginBtn.textContent.trim();
    }

    // ---- FOOTER ----
    const footer = document.querySelector('footer') || document.querySelector('.footer') || document.querySelector('[class*="footer"]');
    if (footer) {
      const footerLogo = footer.querySelector('img, svg, .logo');
      if (footerLogo) {
        const r = rect(footerLogo);
        results.footerLogoWidth = r.width;
        results.footerLogoHeight = r.height;
      }

      const footerLinks = Array.from(footer.querySelectorAll('a, nav a')).filter(a => {
        const t = a.textContent.trim();
        return t.length > 0 && t.length < 50 && !a.querySelector('img') && !a.querySelector('svg');
      });
      if (footerLinks.length > 0) {
        const fl = footerLinks[0];
        results.footerNavFontSize = cs(fl, 'font-size');
        results.footerNavLetterSpacing = cs(fl, 'letter-spacing');
        results.footerNavFontWeight = cs(fl, 'font-weight');
        results.footerNavLinkTexts = footerLinks.slice(0, 6).map(a => a.textContent.trim());

        if (footerLinks.length >= 2) {
          const fr1 = footerLinks[0].getBoundingClientRect();
          const fr2 = footerLinks[1].getBoundingClientRect();
          const isHorizontal = Math.abs(fr1.top - fr2.top) < 10;
          results.footerNavGap = isHorizontal
            ? Math.round(fr2.left - fr1.right)
            : Math.round(fr2.top - fr1.bottom);
          results.footerNavDirection = isHorizontal ? 'horizontal' : 'vertical';
        }
      }

      const footerTextEls = Array.from(footer.querySelectorAll('p, span, address, [class*="address"], [class*="contact"]')).filter(el => {
        const t = el.textContent.trim();
        return t.length > 0 && (t.includes('@') || t.includes(',') || /\d{4}/.test(t));
      });
      if (footerTextEls.length > 0) {
        const ft = footerTextEls[0];
        results.footerAddressFontSize = cs(ft, 'font-size');
        results.footerAddressLetterSpacing = cs(ft, 'letter-spacing');
        results.footerAddressTextAlign = cs(ft, 'text-align');
        results.footerAddressSnippet = ft.textContent.trim().slice(0, 80);
      }
    }

    return results;
  });

  return { label, data };
}

function printRow(label, liveVal, localVal) {
  const match = liveVal === localVal ? '  OK' : '  DIFF';
  console.log(`  ${label.padEnd(32)} ${String(liveVal).padEnd(22)} ${String(localVal).padEnd(22)} ${match}`);
}

function printResults(live, local) {
  const allKeys = new Set([...Object.keys(live), ...Object.keys(local)]);
  const skip = new Set(['navLinkTexts', 'footerNavLinkTexts', 'footerNavDirection', 'loginBtnText', 'footerAddressSnippet']);

  console.log('\n' + '='.repeat(82));
  console.log(`  ${'Measurement'.padEnd(32)} ${'LIVE (monolithrisk.com)'.padEnd(22)} ${'LOCAL (localhost:8080)'.padEnd(22)} Match`);
  console.log('='.repeat(82));

  for (const key of allKeys) {
    if (skip.has(key)) continue;
    printRow(key, live[key] ?? 'N/A', local[key] ?? 'N/A');
  }

  console.log('='.repeat(82));
  console.log('\n  Nav link texts (live)  :', live.navLinkTexts?.join(' | '));
  console.log('  Nav link texts (local) :', local.navLinkTexts?.join(' | '));
  console.log('  Footer links (live)    :', live.footerNavLinkTexts?.join(' | '));
  console.log('  Footer links (local)   :', local.footerNavLinkTexts?.join(' | '));
  if (live.loginBtnText)        console.log('  Login btn text (live)  :', live.loginBtnText);
  if (local.loginBtnText)       console.log('  Login btn text (local) :', local.loginBtnText);
  if (live.footerAddressSnippet)  console.log('  Footer address (live)  :', live.footerAddressSnippet);
  if (local.footerAddressSnippet) console.log('  Footer address (local) :', local.footerAddressSnippet);
  console.log('  Footer nav direction   :', live.footerNavDirection, '/', local.footerNavDirection);
}

(async () => {
  const browser = await chromium.launch();

  // ---- LIVE ----
  const page1 = await browser.newPage();
  await page1.setViewportSize(VIEWPORT);
  console.log('\nLoading https://www.monolithrisk.com ...');
  await page1.goto('https://www.monolithrisk.com', { waitUntil: 'load', timeout: 30000 });
  await page1.waitForTimeout(1000);
  const liveResult = await measure(page1, 'live');
  await page1.screenshot({ path: '/tmp/live-header.png', clip: { x: 0, y: 0, width: 1440, height: 160 } });
  await page1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: '/tmp/live-footer.png' });
  await page1.close();

  // ---- LOCAL ----
  const page2 = await browser.newPage();
  await page2.setViewportSize(VIEWPORT);
  console.log('Loading http://localhost:8080 ...');
  await page2.goto('http://localhost:8080', { waitUntil: 'load', timeout: 15000 });
  await page2.waitForTimeout(1000);
  const localResult = await measure(page2, 'local');
  await page2.screenshot({ path: '/tmp/local-header.png', clip: { x: 0, y: 0, width: 1440, height: 160 } });
  // scroll to footer
  await page2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: '/tmp/local-footer.png', clip: { x: 0, y: page2.viewportSize().height - 300, width: 1440, height: 300 } });
  await page2.close();

  await browser.close();

  printResults(liveResult.data, localResult.data);
})();
