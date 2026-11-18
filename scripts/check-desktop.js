const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('http://localhost:8080', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/local-desktop-1024.png' });

  // Check nav links visible and feature cards are 4-col
  const info = await page.evaluate(() => {
    const navLinks = document.querySelector('.nav-links');
    const hamburger = document.querySelector('.nav-hamburger');
    const cards = document.querySelectorAll('#built .feature-card');
    const firstCard = cards[0];
    const secondCard = cards[1];
    const sideBySide = firstCard && secondCard &&
      Math.abs(firstCard.getBoundingClientRect().top - secondCard.getBoundingClientRect().top) < 10;
    return {
      navLinksVisible: navLinks ? window.getComputedStyle(navLinks).display !== 'none' : false,
      hamburgerHidden: hamburger ? window.getComputedStyle(hamburger).display === 'none' : false,
      cardsSideBySide: sideBySide,
      firstCardLeft: firstCard ? Math.round(firstCard.getBoundingClientRect().left) : null,
      secondCardLeft: secondCard ? Math.round(secondCard.getBoundingClientRect().left) : null,
    };
  });
  console.log('Desktop 1024px check:', JSON.stringify(info, null, 2));

  await browser.close();
})();
