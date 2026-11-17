#!/usr/bin/env node
/**
 * capture-baseline.js — v2
 * Captures a full baseline snapshot of monolithrisk.com for Wix-to-Azure migration.
 *
 * Outputs:
 *   baseline/index.html          – fully rendered HTML (after full lazy-load scroll)
 *   baseline/screenshots/        – desktop (1440), tablet (768), mobile (390)
 *   baseline/images/             – full-res Wix static images
 *   baseline/videos/             – hero video + any other video assets
 *   baseline/icons/              – SVG icons from feature cards
 *   baseline/meta.json           – all meta / OG / Twitter / canonical / favicon
 *   baseline/inventory.md        – fonts, scripts, links, form fields, videos, animations
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TARGET_URL = 'https://www.monolithrisk.com';
const BASE_DIR   = path.resolve(__dirname, '..', 'baseline');
const SS_DIR     = path.join(BASE_DIR, 'screenshots');
const IMG_DIR    = path.join(BASE_DIR, 'images');
const VID_DIR    = path.join(BASE_DIR, 'videos');
const ICON_DIR   = path.join(BASE_DIR, 'icons');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── helpers ───────────────────────────────────────────────────────────────────

function mkdirs() {
  [BASE_DIR, SS_DIR, IMG_DIR, VID_DIR, ICON_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

function wixOriginalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const m = u.pathname.match(/^(\/media\/[^/]+)/);
    if (m) return `https://static.wixstatic.com${m[1]}`;
    return `https://static.wixstatic.com${u.pathname.split('?')[0]}`;
  } catch { return rawUrl; }
}

function safeFilename(url, index, prefix = '') {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname.split('/v1/')[0]).replace(/%7E/gi, '~');
    const clean = base.replace(/[^a-zA-Z0-9._~-]/g, '_');
    return (prefix + clean) || `${prefix}file_${index}`;
  } catch { return `${prefix}file_${index}`; }
}

/**
 * Scroll the full page one viewport height per step, 1 s pause each step.
 * After reaching the bottom wait 4 s for content to settle, then scroll back.
 */
async function slowScrollAndSettle(page) {
  console.log('  Slow-scrolling to trigger lazy load…');
  const vpHeight = page.viewportSize().height;
  let scrollY = 0;

  while (true) {
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    if (scrollY >= pageHeight) break;
    scrollY = Math.min(scrollY + vpHeight, pageHeight);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), scrollY);
    await page.waitForTimeout(1000);
  }

  console.log('  Waiting for content to settle…');
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1000);
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  mkdirs();

  console.log(`Launching browser → ${TARGET_URL}`);
  const browser = await chromium.launch({ headless: true });

  // ── Primary desktop page (1440) ───────────────────────────────────────────
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const page    = await context.newPage();

  const networkRequests = [];
  page.on('request', req => networkRequests.push(req.url()));

  await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(3000);
  await slowScrollAndSettle(page);

  // ── 1. HTML ────────────────────────────────────────────────────────────────
  console.log('Saving HTML…');
  const html = await page.content();
  fs.writeFileSync(path.join(BASE_DIR, 'index.html'), html, 'utf8');
  console.log(`  → baseline/index.html  (${(html.length / 1024).toFixed(1)} KB)`);

  // ── 4. Meta tags ──────────────────────────────────────────────────────────
  console.log('Extracting meta tags…');
  const meta = await page.evaluate(() => {
    const r = { title: document.title || null, description: null, canonical: null, favicon: null, openGraph: {}, twitter: {}, other: {} };
    const desc = document.querySelector('meta[name="description"]');
    if (desc) r.description = desc.getAttribute('content');
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) r.canonical = canon.getAttribute('href');
    const fav = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="apple-touch-icon"]');
    if (fav) r.favicon = fav.getAttribute('href');
    document.querySelectorAll('meta').forEach(m => {
      const name = m.getAttribute('name') || '', prop = m.getAttribute('property') || '', content = m.getAttribute('content') || '';
      if (prop.startsWith('og:')) r.openGraph[prop] = content;
      else if (name.startsWith('twitter:')) r.twitter[name] = content;
      else if (name && name !== 'description') r.other[name] = content;
    });
    return r;
  });
  fs.writeFileSync(path.join(BASE_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('  → baseline/meta.json');

  // ── Inspect Platform section blank area ───────────────────────────────────
  console.log('Inspecting Platform section blank area…');
  const platformSection = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('*')].find(el =>
      el.children.length < 10 && /every property|every policy|one system/i.test(el.textContent)
    );
    if (!heading) return { found: false, note: 'Platform heading not found in DOM' };

    // Walk up to find a tall container
    let section = heading;
    for (let i = 0; i < 12; i++) {
      if (!section.parentElement) break;
      section = section.parentElement;
      if (section.getBoundingClientRect().height > 300) break;
    }

    const interesting = [];
    section.querySelectorAll('video, canvas, iframe, [data-motion], img, svg').forEach(el => {
      const rect = el.getBoundingClientRect();
      interesting.push({
        tag:        el.tagName.toLowerCase(),
        src:        el.getAttribute('src') || el.getAttribute('data-src') || null,
        poster:     el.getAttribute('poster') || null,
        id:         el.id || null,
        classList:  [...el.classList].join(' ').slice(0, 120),
        width:      Math.round(rect.width),
        height:     Math.round(rect.height),
        dataAttrs:  Object.fromEntries(
          [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value.slice(0, 120)])
        ),
      });
    });

    const sRect = section.getBoundingClientRect();
    return {
      found: true,
      headingText: heading.textContent.trim().slice(0, 120),
      sectionTag:  section.tagName,
      sectionClasses: [...section.classList].join(' ').slice(0, 120),
      sectionSize: `${Math.round(sRect.width)}×${Math.round(sRect.height)}px`,
      interestingElements: interesting,
    };
  });

  // ── Detect hero animations ────────────────────────────────────────────────
  console.log('Detecting hero animations…');
  const heroAnimations = await page.evaluate(() => {
    const results = [];

    // Canvas elements (Lottie / WebGL / particle)
    document.querySelectorAll('canvas').forEach(c => {
      const r = c.getBoundingClientRect();
      results.push({ type: 'canvas', id: c.id || null, width: Math.round(r.width), height: Math.round(r.height), classes: [...c.classList].join(' ').slice(0, 80) });
    });

    // Lottie player
    if (document.querySelector('[data-lottie], [data-bodymovin], lottie-player, [class*="lottie"]')) {
      results.push({ type: 'lottie', note: 'Lottie player element found' });
    }

    // SVG SMIL animations
    const svgAnimCount = document.querySelectorAll('animate, animateTransform, animateMotion').length;
    if (svgAnimCount) results.push({ type: 'svg-animation', count: svgAnimCount });

    // Circle/ring elements near the hero heading
    const circleEls = [...document.querySelectorAll('[class*="circle"],[class*="Circle"],[class*="ring"],[class*="Ring"],[class*="orbit"],[class*="Orbit"]')];
    circleEls.slice(0, 8).forEach(el => {
      const r = el.getBoundingClientRect();
      results.push({ type: 'circle-element', tag: el.tagName, classes: [...el.classList].join(' ').slice(0, 100), width: Math.round(r.width), height: Math.round(r.height) });
    });

    // CSS keyframe names defined on the page
    const keyframeNames = [];
    [...document.styleSheets].forEach(sheet => {
      try {
        [...sheet.cssRules].forEach(rule => {
          if (rule.type === CSSRule.KEYFRAMES_RULE) keyframeNames.push(rule.name);
        });
      } catch {}
    });
    if (keyframeNames.length) results.push({ type: 'keyframes-defined', names: keyframeNames });

    // CSS animations on elements near "MONOLITH" text
    const monolithEl = [...document.querySelectorAll('*')].find(el =>
      /\bmonolith\b/i.test(el.textContent) && el.children.length < 5
    );
    if (monolithEl) {
      let el = monolithEl;
      for (let i = 0; i < 8 && el; i++) {
        const anim = getComputedStyle(el).animationName;
        if (anim && anim !== 'none') {
          results.push({ type: 'css-animation', element: el.tagName, classes: [...el.classList].join(' ').slice(0, 80), animationName: anim });
        }
        el = el.parentElement;
      }
    }

    return results;
  });

  // ── Collect inline SVG icons ──────────────────────────────────────────────
  console.log('Collecting SVG icons…');
  const svgData = await page.evaluate(() => {
    const icons = [];
    const seen  = new Set();

    document.querySelectorAll('svg').forEach((svg, i) => {
      const content = svg.outerHTML;
      const key     = content.slice(0, 150);
      if (seen.has(key)) return;
      seen.add(key);

      const rect = svg.getBoundingClientRect();
      const w    = rect.width  || parseFloat(svg.getAttribute('width'))  || 0;
      const h    = rect.height || parseFloat(svg.getAttribute('height')) || 0;
      // Keep only small icons, skip huge illustrative SVGs
      if (w > 200 || h > 200 || content.length > 20000) return;

      icons.push({
        type:      'inline',
        index:     i,
        width:     Math.round(w),
        height:    Math.round(h),
        ariaLabel: svg.getAttribute('aria-label') || svg.querySelector('title')?.textContent || null,
        classes:   [...svg.classList].join(' ').slice(0, 80),
        content,
      });
    });

    document.querySelectorAll('img[src*=".svg"]').forEach(img => {
      icons.push({ type: 'img-svg', src: img.getAttribute('src'), alt: img.getAttribute('alt') || null });
    });

    return icons;
  });

  // ── 5 & 6. General inventory ──────────────────────────────────────────────
  console.log('Building general inventory…');
  const inventory = await page.evaluate(() => {
    const fontSet = new Set();
    document.querySelectorAll('style').forEach(s => {
      [...s.textContent.matchAll(/font-family\s*:\s*['"]?([^;'"{}]+)['"]?/g)].forEach(m => fontSet.add(m[1].trim()));
    });
    fontSet.add(`body computed: ${getComputedStyle(document.body).fontFamily}`);

    const scripts = [...document.querySelectorAll('script[src]')]
      .map(s => s.getAttribute('src'))
      .filter(src => src && !src.includes('wix') && !src.includes('localhost'));

    const links = [...document.querySelectorAll('a[href]')]
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 80), href: a.href }))
      .filter(l => l.href && !l.href.startsWith('javascript'));

    const forms = [...document.querySelectorAll('form')].map((form, fi) => ({
      formIndex: fi,
      action: form.getAttribute('action') || null,
      method: form.getAttribute('method') || 'get',
      id: form.getAttribute('id') || null,
      fields: [...form.querySelectorAll('input, textarea, select')].map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || null,
        name: el.getAttribute('name') || null,
        id: el.getAttribute('id') || null,
        placeholder: el.getAttribute('placeholder') || null,
        required: el.hasAttribute('required'),
        pattern: el.getAttribute('pattern') || null,
        minlength: el.getAttribute('minlength') || null,
        maxlength: el.getAttribute('maxlength') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
      })),
    }));

    const iframes = [...document.querySelectorAll('iframe')].map(f => ({
      src: f.getAttribute('src') || null,
      title: f.getAttribute('title') || null,
      id: f.getAttribute('id') || null,
    }));

    // Video elements in DOM
    const videos = [...document.querySelectorAll('video')].map((v, i) => ({
      index: i,
      src: v.getAttribute('src') || null,
      poster: v.getAttribute('poster') || null,
      autoplay: v.hasAttribute('autoplay'),
      loop: v.hasAttribute('loop'),
      muted: v.hasAttribute('muted'),
      sources: [...v.querySelectorAll('source')].map(s => ({ src: s.getAttribute('src'), type: s.getAttribute('type') })),
    }));

    return { fonts: [...fontSet], scripts, links, forms, iframes, videos };
  });

  // Video URLs: DOM + network requests
  const videoNetworkUrls = [...new Set(networkRequests.filter(u =>
    u.includes('video.wixstatic.com') || /\.(mp4|webm|m3u8)(\?|$)/i.test(u)
  ))];

  const allVideoUrls = new Set();
  inventory.videos.forEach(v => {
    if (v.src) allVideoUrls.add(v.src);
    v.sources.forEach(s => { if (s.src) allVideoUrls.add(s.src); });
  });
  videoNetworkUrls.forEach(u => allVideoUrls.add(u));

  // Video poster images → go to images dir
  const videoPosterUrls = new Set();
  inventory.videos.forEach(v => { if (v.poster) videoPosterUrls.add(v.poster); });

  // Analytics detection
  const analyticsPatterns = [
    { label: 'Google Analytics / GA4', pattern: /google-analytics\.com|googletagmanager\.com|gtag/ },
    { label: 'Google Tag Manager',      pattern: /googletagmanager\.com\/gtm/ },
    { label: 'Facebook Pixel',          pattern: /facebook\.com\/tr|fbevents\.js/ },
    { label: 'LinkedIn Insight',        pattern: /linkedin\.com\/insight|snap\.licdn\.com/ },
    { label: 'HubSpot',                 pattern: /hubspot\.com|hs-scripts/ },
    { label: 'Intercom',                pattern: /intercom\.io|widget\.intercom/ },
    { label: 'Drift',                   pattern: /drift\.com|js\.driftt\.com/ },
    { label: 'Hotjar',                  pattern: /hotjar\.com/ },
    { label: 'Segment',                 pattern: /segment\.com|cdn\.segment\.io/ },
    { label: 'Crisp',                   pattern: /crisp\.chat/ },
    { label: 'Tidio',                   pattern: /tidio\.com/ },
    { label: 'Zendesk',                 pattern: /zendesk\.com|zopim\.com/ },
  ];
  const detectedAnalytics = [];
  analyticsPatterns.forEach(({ label, pattern }) => {
    const hit = networkRequests.find(u => pattern.test(u));
    if (hit) detectedAnalytics.push({ label, url: hit });
  });

  // ── 3. Collect Wix image URLs ─────────────────────────────────────────────
  console.log('Collecting Wix image URLs…');
  const rawWixUrls = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img').forEach(img => {
      ['src','data-src','data-lazy-src','data-pin-media'].forEach(attr => {
        const v = img.getAttribute(attr) || '';
        if (v.includes('wixstatic.com')) urls.add(v);
      });
      (img.getAttribute('srcset') || '').split(',').forEach(part => {
        const u = part.trim().split(/\s+/)[0];
        if (u && u.includes('static.wixstatic.com')) urls.add(u);
      });
    });
    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      [...style.matchAll(/url\(['"]?(https?:\/\/[^'")\s]+wixstatic\.com[^'")\s]*)['"]?\)/g)].forEach(m => urls.add(m[1]));
    });
    document.querySelectorAll('[data-src*="wixstatic"]').forEach(el => urls.add(el.getAttribute('data-src')));
    return [...urls];
  });

  // Add any image URLs spotted in network traffic
  networkRequests
    .filter(u => u.includes('static.wixstatic.com') && /\.(jpg|jpeg|png|gif|webp)(\?|\/|$)/i.test(u))
    .forEach(u => rawWixUrls.push(u));

  const seenOriginals = new Map();
  rawWixUrls.filter(Boolean).forEach(raw => {
    const orig = wixOriginalUrl(raw);
    if (!seenOriginals.has(orig)) seenOriginals.set(orig, raw);
  });
  // Also add video poster URLs as images
  videoPosterUrls.forEach(url => {
    if (!seenOriginals.has(url)) seenOriginals.set(url, url);
  });

  console.log(`  Found ${seenOriginals.size} unique Wix images`);

  // ── 2. Screenshots ────────────────────────────────────────────────────────
  const viewports = [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'tablet',  width: 768,  height: 1024 },
    { label: 'mobile',  width: 390,  height: 844 },
  ];

  for (const vp of viewports) {
    console.log(`Taking ${vp.label} screenshot (${vp.width}px)…`);
    const vpCtx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, userAgent: UA });
    const vpPage = await vpCtx.newPage();
    await vpPage.goto(TARGET_URL, { waitUntil: 'load', timeout: 90000 });
    await vpPage.waitForTimeout(3000);
    await slowScrollAndSettle(vpPage);
    await vpPage.screenshot({ path: path.join(SS_DIR, `${vp.label}-${vp.width}.png`), fullPage: true });
    console.log(`  → baseline/screenshots/${vp.label}-${vp.width}.png`);
    await vpCtx.close();
  }

  // ── Download images ───────────────────────────────────────────────────────
  console.log('Downloading images…');
  let imgDownloaded = 0, imgSkipped = 0;
  const imageManifest = [];
  let idx = 0;
  for (const [originalUrl] of seenOriginals) {
    idx++;
    const filename = safeFilename(originalUrl, idx);
    const dest = path.join(IMG_DIR, filename);
    if (fs.existsSync(dest)) {
      imgSkipped++;
      imageManifest.push({ filename, originalUrl, bytes: fs.statSync(dest).size });
    } else {
      try {
        await download(originalUrl, dest);
        const { size } = fs.statSync(dest);
        console.log(`  [${idx}/${seenOriginals.size}] ${filename}  (${(size/1024).toFixed(1)} KB)`);
        imgDownloaded++;
        imageManifest.push({ filename, originalUrl, bytes: size });
      } catch (err) {
        console.warn(`  WARN image: ${err.message}  ${originalUrl}`);
        imageManifest.push({ filename, originalUrl, error: err.message });
      }
    }
  }

  // ── Download videos ───────────────────────────────────────────────────────
  console.log('Downloading videos…');
  let vidDownloaded = 0;
  const videoManifest = [];
  let vidIdx = 0;
  for (const url of allVideoUrls) {
    vidIdx++;
    const filename = safeFilename(url, vidIdx);
    const dest = path.join(VID_DIR, filename);
    if (fs.existsSync(dest)) {
      videoManifest.push({ filename, url, bytes: fs.statSync(dest).size });
      continue;
    }
    try {
      console.log(`  [${vidIdx}/${allVideoUrls.size}] ${filename}`);
      await download(url, dest);
      const { size } = fs.statSync(dest);
      console.log(`    → ${(size/1024/1024).toFixed(2)} MB`);
      vidDownloaded++;
      videoManifest.push({ filename, url, bytes: size });
    } catch (err) {
      console.warn(`  WARN video: ${err.message}  ${url}`);
      videoManifest.push({ filename, url, error: err.message });
    }
  }

  // ── Save SVG icons ────────────────────────────────────────────────────────
  console.log('Saving SVG icons…');
  let iconsSaved = 0;
  const iconManifest = [];
  const seenSvgKey   = new Set();

  for (const icon of svgData.filter(i => i.type === 'inline')) {
    const key = icon.content.slice(0, 200);
    if (seenSvgKey.has(key)) continue;
    seenSvgKey.add(key);
    const label    = (icon.ariaLabel || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || null;
    const filename = `icon-${String(iconsSaved + 1).padStart(2, '0')}${label ? '-' + label : ''}.svg`;
    fs.writeFileSync(path.join(ICON_DIR, filename), icon.content, 'utf8');
    iconsSaved++;
    iconManifest.push({ filename, ariaLabel: icon.ariaLabel, width: icon.width, height: icon.height });
  }
  for (const icon of svgData.filter(i => i.type === 'img-svg')) {
    const filename = safeFilename(icon.src, iconsSaved + 1);
    const dest     = path.join(ICON_DIR, filename);
    if (!fs.existsSync(dest)) {
      try {
        const fullUrl = icon.src.startsWith('http') ? icon.src : `https://www.monolithrisk.com${icon.src}`;
        await download(fullUrl, dest);
        iconsSaved++;
        iconManifest.push({ filename, src: icon.src, alt: icon.alt });
      } catch (err) { console.warn(`  WARN icon: ${err.message}`); }
    }
  }
  console.log(`  Saved ${iconsSaved} icons`);

  // ── Write inventory.md ────────────────────────────────────────────────────
  console.log('Writing inventory.md…');
  const md = [];
  md.push('# monolithrisk.com — Baseline Inventory');
  md.push(`\n_Captured: ${new Date().toISOString()}_\n`);

  // Platform section
  md.push('## Platform Section — Blank Area Analysis');
  if (platformSection.found) {
    md.push(`**Heading found:** "${platformSection.headingText}"`);
    md.push(`**Section element:** \`<${platformSection.sectionTag}>\` \`${platformSection.sectionClasses}\` — ${platformSection.sectionSize}`);
    if (platformSection.interestingElements.length) {
      md.push('\n**Elements inside the Platform section:**\n');
      md.push('| Tag | W×H | Src / Classes | Data attrs |');
      md.push('|-----|-----|---------------|------------|');
      platformSection.interestingElements.forEach(el => {
        const dataStr = Object.entries(el.dataAttrs || {}).map(([k,v]) => `${k}="${v}"`).join('; ').slice(0, 100);
        md.push(`| \`<${el.tag}>\` | ${el.width}×${el.height} | ${el.src || el.classList} | ${dataStr} |`);
      });
    } else {
      md.push('\n_No `<video>`, `<canvas>`, `<iframe>`, or `<svg>` children found in the Platform section._');
      md.push('_The blank area is likely a **Wix App Widget** (embedded via a Wix-internal protocol) or a background element that only renders inside the Wix editor/viewer. Candidates: animated graphic from `filesusr.com` iframe, or a Wix "ProGallery"/"Slideshow" component rendered in a shadow root._');
    }
  } else {
    md.push(`_${platformSection.note}_`);
  }

  // Hero animations
  md.push('\n## Hero Animations (MONOLITH title circle effect)');
  if (heroAnimations.length) {
    heroAnimations.forEach(a => {
      if (a.type === 'keyframes-defined') {
        md.push(`\n**CSS @keyframes defined on page:** ${a.names.join(', ')}`);
      } else if (a.type === 'canvas') {
        md.push(`- **\`<canvas>\`** id="${a.id}" ${a.width}×${a.height}px classes: \`${a.classes}\``);
      } else if (a.type === 'css-animation') {
        md.push(`- **CSS animation** on \`<${a.element}>\` (\`${a.classes}\`): \`${a.animationName}\``);
      } else if (a.type === 'circle-element') {
        md.push(`- **Circle/ring element** \`<${a.tag}>\` classes: \`${a.classes}\` — ${a.width}×${a.height}px`);
      } else if (a.type === 'lottie') {
        md.push(`- **${a.note}**`);
      } else if (a.type === 'svg-animation') {
        md.push(`- **SVG SMIL animations:** ${a.count} \`<animate>\` / \`<animateTransform>\` elements`);
      }
    });
  } else {
    md.push('_No canvas, Lottie, or CSS animation elements detected. The circle effect is likely a Wix-rendered video overlay or a CSS `clip-path` / `mask` animation applied at runtime inside a Wix component shadow root._');
  }

  // Fonts
  md.push('\n## Fonts');
  const namedFonts = [...new Set(
    inventory.fonts
      .filter(f => !f.startsWith('var(') && !f.includes('{') && !f.startsWith('body computed'))
      .map(f => f.replace(/,.*$/, '').trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  )].sort();
  namedFonts.forEach(f => md.push(`- \`${f}\``));
  const bodyFont = inventory.fonts.find(f => f.startsWith('body computed:'));
  if (bodyFont) md.push(`\n_Body computed font: \`${bodyFont.replace('body computed: ', '')}\`_`);

  // External scripts
  md.push('\n## External Scripts');
  if (inventory.scripts.length) {
    inventory.scripts.forEach(s => md.push(`- \`${s}\``));
  } else {
    md.push('_None outside Wix bundles._');
  }

  // Analytics
  md.push('\n## Analytics & Tracking Pixels');
  if (detectedAnalytics.length) {
    detectedAnalytics.forEach(a => md.push(`- **${a.label}**: \`${a.url}\``));
  } else {
    md.push('_None detected in network requests._');
  }

  // iframes
  md.push('\n## Embedded iFrames');
  if (inventory.iframes.length) {
    inventory.iframes.forEach(f => md.push(`- \`${f.src || '(no src)'}\`${f.title ? ` — ${f.title}` : ''}${f.id ? ` (id: ${f.id})` : ''}`));
  } else {
    md.push('_None._');
  }

  // Links
  const internalLinks = [...new Map(
    inventory.links.filter(l => l.href.includes('monolithrisk.com')).map(l => [l.href, l])
  ).values()];
  const externalLinks = [...new Map(
    inventory.links.filter(l => !l.href.includes('monolithrisk.com')).map(l => [l.href, l])
  ).values()];
  md.push('\n## Site Links\n### Internal');
  internalLinks.length ? internalLinks.forEach(l => md.push(`- [${l.text || l.href}](${l.href})`)) : md.push('_None._');
  md.push('\n### External');
  externalLinks.length ? externalLinks.forEach(l => md.push(`- [${l.text || l.href}](${l.href})`)) : md.push('_None._');

  // Forms
  md.push('\n## Contact Form Fields');
  if (inventory.forms.length) {
    inventory.forms.forEach(form => {
      md.push(`\n### Form ${form.formIndex + 1}${form.id ? ` id="${form.id}"` : ''}${form.action ? ` action="${form.action}"` : ''} (method: ${form.method})`);
      if (form.fields.length) {
        md.push('| Tag | Type | Name | Placeholder | Required | Pattern | Min/MaxLen | aria-label |');
        md.push('|-----|------|------|-------------|----------|---------|-----------|------------|');
        form.fields.forEach(f => md.push(`| ${f.tag} | ${f.type||''} | ${f.name||''} | ${f.placeholder||''} | ${f.required?'yes':'no'} | ${f.pattern||''} | ${f.minlength||''}/${f.maxlength||''} | ${f.ariaLabel||''} |`));
      } else {
        md.push('_No standard input fields (may be in shadow DOM)._');
      }
    });
  } else {
    md.push('_No `<form>` elements in DOM._');
  }

  // Videos
  md.push('\n## Videos');
  if (videoManifest.length) {
    md.push('| Filename | Size | URL |');
    md.push('|----------|------|-----|');
    videoManifest.forEach(v => {
      const size = v.bytes ? `${(v.bytes/1024/1024).toFixed(2)} MB` : (v.error ? `_${v.error}_` : '?');
      md.push(`| ${v.filename} | ${size} | \`${v.url}\` |`);
    });
  } else {
    md.push('_No video files detected._');
  }
  if (allVideoUrls.size === 0) {
    md.push('\n> **Note:** Hero video may not appear in network requests if served via HLS/DASH manifest or Wix\'s internal streaming. Inspect DevTools Network tab filtering by "media" on the live site to get the direct `.mp4` URL.');
  }

  // Icons
  md.push('\n## SVG Icons (feature cards)');
  if (iconManifest.length) {
    md.push('| Filename | Label | Size |');
    md.push('|----------|-------|------|');
    iconManifest.forEach(ic => md.push(`| ${ic.filename} | ${ic.ariaLabel || ic.alt || ''} | ${ic.width||'?'}×${ic.height||'?'} |`));
  } else {
    md.push('_No inline SVG icons found. Icons may be rendered as CSS `background-image` with data URIs or via a Wix icon component._');
  }

  // Images
  md.push('\n## Wix Images Downloaded');
  md.push(`Total: ${seenOriginals.size} unique originals — ${imgDownloaded} downloaded, ${imgSkipped} already existed\n`);
  md.push('| Filename | Size | Original URL |');
  md.push('|----------|------|-------------|');
  imageManifest.forEach(m => {
    const size = m.error ? `_${m.error}_` : `${((m.bytes||0)/1024).toFixed(1)} KB`;
    md.push(`| ${m.filename} | ${size} | \`${m.originalUrl}\` |`);
  });

  fs.writeFileSync(path.join(BASE_DIR, 'inventory.md'), md.join('\n'), 'utf8');
  console.log('  → baseline/inventory.md');

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BASELINE CAPTURE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`HTML saved         : baseline/index.html  (${(html.length/1024).toFixed(1)} KB)`);
  console.log(`Screenshots        : ${viewports.length} files in baseline/screenshots/`);
  console.log(`Images             : ${imgDownloaded} new + ${imgSkipped} cached → baseline/images/`);
  console.log(`Videos             : ${vidDownloaded} downloaded (${allVideoUrls.size} URLs found) → baseline/videos/`);
  console.log(`Icons              : ${iconsSaved} saved → baseline/icons/`);
  console.log(`Meta tags          : baseline/meta.json`);
  console.log(`Inventory          : baseline/inventory.md`);
  console.log(`Analytics found    : ${detectedAnalytics.map(a => a.label).join(', ') || 'none'}`);
  console.log(`Forms in DOM       : ${inventory.forms.length}`);
  console.log(`iFrames            : ${inventory.iframes.length}`);
  console.log(`Platform section   : ${platformSection.found ? platformSection.interestingElements.length + ' child elements' : 'NOT FOUND IN DOM'}`);
  console.log(`Hero anim signals  : ${heroAnimations.length}`);
})();
