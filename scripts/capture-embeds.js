#!/usr/bin/env node
/**
 * capture-embeds.js
 * 1. Downloads every filesusr.com iframe embed (HTML + all sub-resources).
 * 2. Audits every UGC SVG icon on the page and saves any missing from baseline/icons/.
 * 3. Appends findings to baseline/inventory.md.
 */

const { chromium } = require('playwright');
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TARGET_URL = 'https://www.monolithrisk.com';
const BASE_DIR   = path.resolve(__dirname, '..', 'baseline');
const EMBEDS_DIR = path.join(BASE_DIR, 'embeds');
const ICONS_DIR  = path.join(BASE_DIR, 'icons');
const INVENTORY  = path.join(BASE_DIR, 'inventory.md');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB per asset

// ── helpers ───────────────────────────────────────────────────────────────────

function mkdirs(...dirs) {
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function slugFromUrl(url) {
  try {
    return path.basename(new URL(url).pathname, '.html').replace(/[^a-zA-Z0-9_-]/g, '_').slice(-32);
  } catch { return 'embed'; }
}

function safeFilename(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname).replace(/[^a-zA-Z0-9._~-]/g, '_');
    return base || 'file';
  } catch { return 'file'; }
}

function resourceType(url) {
  const ext = (url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase();
  if (!ext) return 'other';
  if (ext === 'css') return 'css';
  if (['js', 'mjs'].includes(ext)) return 'js';
  if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) return 'font';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) return 'video';
  if (ext === 'json') return 'json';
  return 'other';
}

function download(url, dest, maxBytes = MAX_ASSET_BYTES) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let received = 0;
    const get = url.startsWith('https') ? https.get : http.get;
    const req = get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        return download(res.headers.location, dest, maxBytes).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const cl = parseInt(res.headers['content-length'] || '0');
      if (cl > maxBytes) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`too large: ${(cl/1024/1024).toFixed(1)} MB`));
      }
      res.on('data', chunk => {
        received += chunk.length;
        if (received > maxBytes) {
          req.destroy();
          file.close(); try { fs.unlinkSync(dest); } catch {}
          reject(new Error('exceeded size limit mid-stream'));
        }
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(received)));
    });
    req.on('error', err => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

// Known external services / libraries
const SERVICE_PATTERNS = [
  { label: 'Google Maps',       re: /maps\.googleapis\.com|maps\.google\.com/ },
  { label: 'Mapbox',            re: /mapbox\.com/ },
  { label: 'Google Analytics',  re: /google-analytics\.com|googletagmanager\.com/ },
  { label: 'Facebook Pixel',    re: /facebook\.com\/tr|fbevents/ },
  { label: 'Chart.js',          re: /chart\.js|chartjs\.org/ },
  { label: 'D3.js',             re: /d3js\.org|\/d3\./ },
  { label: 'Leaflet',           re: /leafletjs\.com|leaflet\.js/ },
  { label: 'Three.js',          re: /three\.js|threejs\.org/ },
  { label: 'GSAP',              re: /gsap\.com|TweenMax|TweenLite/ },
  { label: 'Lottie',            re: /lottie|bodymovin/ },
  { label: 'AOS',               re: /aos\.js/ },
  { label: 'Sentry',            re: /sentry\.io|sentry-cdn/ },
  { label: 'HubSpot',           re: /hubspot\.com/ },
  { label: 'Calendly',          re: /calendly\.com/ },
  { label: 'Firebase',          re: /firebase|firebaseio\.com/ },
  { label: 'Airtable',          re: /airtable\.com/ },
  { label: 'Typeform',          re: /typeform\.com/ },
  { label: 'Vercel/CDN',        re: /vercel\.com|cdn\.jsdelivr\.net/ },
  { label: 'unpkg CDN',         re: /unpkg\.com/ },
  { label: 'cdnjs',             re: /cdnjs\.cloudflare\.com/ },
];

function detectServices(urls) {
  const found = [];
  SERVICE_PATTERNS.forEach(({ label, re }) => {
    const hit = urls.find(u => re.test(u));
    if (hit) found.push({ label, url: hit });
  });
  // Any external domain not covered above
  const knownHosts = /wix|filesusr|parastorage|google|facebook|sentry|cloudflare|jsdelivr|unpkg/;
  const unknownExternal = [...new Set(urls.filter(u => {
    try { return !knownHosts.test(new URL(u).hostname); } catch { return false; }
  }))];
  return { found, unknownExternal };
}

// Wix infrastructure scripts to skip downloading (not part of embed logic)
const SKIP_PATTERNS = [
  'thunderbolt', 'parastorage.com/services/tag-manager',
  'sentry-cdn', 'core-js-bundle', 'focus-within', 'requirejs-bolt',
  'react.production', 'react-dom.production', 'lodash.min',
];

async function slowScroll(page) {
  const vpH = page.viewportSize().height;
  let y = 0;
  while (true) {
    const pageH = await page.evaluate(() => document.body.scrollHeight);
    if (y >= pageH) break;
    y = Math.min(y + vpH, pageH);
    await page.evaluate(top => window.scrollTo({ top, behavior: 'smooth' }), y);
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  mkdirs(EMBEDS_DIR, ICONS_DIR);

  const browser = await chromium.launch({ headless: true });

  // ── Step 1: Discover all filesusr.com iframes from live page ─────────────
  console.log('Loading main page to discover iframes…');
  const mainCtx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const mainPage = await mainCtx.newPage();
  await mainPage.goto(TARGET_URL, { waitUntil: 'load', timeout: 90000 });
  await mainPage.waitForTimeout(5000);

  const iframeList = await mainPage.evaluate(() =>
    [...document.querySelectorAll('iframe')]
      .map(f => ({ src: f.getAttribute('src') || '', title: f.getAttribute('title') || null, id: f.id || null }))
      .filter(f => f.src.includes('filesusr.com'))
  );
  await mainCtx.close();

  console.log(`Found ${iframeList.length} filesusr.com embeds\n`);

  // ── Step 2: Capture each embed ───────────────────────────────────────────
  const embedReports = [];

  for (let i = 0; i < iframeList.length; i++) {
    const { src, title } = iframeList[i];
    const slug     = `embed-${String(i+1).padStart(2,'0')}-${slugFromUrl(src)}`;
    const embedDir = path.join(EMBEDS_DIR, slug);
    const assetsDir = path.join(embedDir, 'assets');
    mkdirs(embedDir, assetsDir);

    console.log(`━━ Embed ${i+1}/${iframeList.length}: ${slug}`);
    console.log(`   ${src}`);

    const requests = [];
    const embedCtx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    const embedPage = await embedCtx.newPage();
    embedPage.on('request', req => requests.push(req.url()));

    let report = { src, title, slug };

    try {
      await embedPage.goto(src, { waitUntil: 'load', timeout: 60000 });
      await embedPage.waitForTimeout(5000); // let all JS render

      // Scroll to trigger any lazy content
      await embedPage.evaluate(async () => {
        await new Promise(resolve => {
          let y = 0;
          const t = setInterval(() => {
            window.scrollBy(0, 400);
            y += 400;
            if (y >= document.body.scrollHeight) { clearInterval(t); window.scrollTo(0,0); resolve(); }
          }, 150);
        });
      });
      await embedPage.waitForTimeout(2000);

      // Inspect DOM
      const info = await embedPage.evaluate(() => ({
        title:       document.title?.trim() || null,
        headings:    [...document.querySelectorAll('h1,h2,h3,h4')].map(h => h.textContent.trim()).filter(Boolean),
        bodyText:    document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 600) || '',
        externalScripts: [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')),
        hasCanvas:   !!document.querySelector('canvas'),
        hasSvg:      document.querySelectorAll('svg').length,
        hasVideo:    !!document.querySelector('video'),
        hasTable:    !!document.querySelector('table'),
        hasMap:      !!document.querySelector('[class*="map"],[id*="map"]'),
        hasChart:    !!document.querySelector('[class*="chart"],[id*="chart"],canvas'),
        formFields:  [...document.querySelectorAll('input,select,textarea')].map(el => ({
          tag: el.tagName.toLowerCase(), type: el.type || null, placeholder: el.placeholder || null,
        })),
        linkHrefs:   [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h && !h.startsWith('javascript')),
        bodyClass:   document.body?.className?.slice(0, 120) || '',
        styleCount:  document.querySelectorAll('style').length,
        linkCount:   document.querySelectorAll('link[rel="stylesheet"]').length,
      }));

      // Screenshot
      await embedPage.screenshot({ path: path.join(embedDir, 'screenshot.png'), fullPage: true });

      // Save HTML
      const html = await embedPage.content();
      fs.writeFileSync(path.join(embedDir, 'index.html'), html, 'utf8');
      console.log(`   HTML: ${(html.length/1024).toFixed(1)} KB`);

      // Categorise and detect
      const cats = { css: [], js: [], font: [], image: [], video: [], json: [], other: [] };
      requests.forEach(u => { const t = resourceType(u); (cats[t] || cats.other).push(u); });

      const { found: services, unknownExternal } = detectServices(requests);
      console.log(`   Services: ${services.map(s=>s.label).join(', ') || 'none'}`);
      console.log(`   Network: ${Object.entries(cats).map(([k,v])=>`${k}:${v.length}`).join(' ')}`);

      // Download sub-resources (skip infra noise)
      const toFetch = [...new Set([
        ...cats.css, ...cats.js, ...cats.font, ...cats.image, ...cats.json,
      ].filter(u => !SKIP_PATTERNS.some(p => u.includes(p))))];

      const assetManifest = [];
      for (const assetUrl of toFetch) {
        const filename = safeFilename(assetUrl);
        const dest = path.join(assetsDir, filename);
        if (fs.existsSync(dest)) {
          assetManifest.push({ filename, url: assetUrl, bytes: fs.statSync(dest).size, cached: true });
          continue;
        }
        try {
          const bytes = await download(assetUrl, dest);
          assetManifest.push({ filename, url: assetUrl, bytes });
        } catch (err) {
          assetManifest.push({ filename, url: assetUrl, error: err.message.slice(0, 80) });
          console.warn(`   skip: ${err.message.slice(0,50)}  …${assetUrl.slice(-60)}`);
        }
      }

      const savedAssets = assetManifest.filter(a => !a.error && !a.cached).length;
      console.log(`   Assets downloaded: ${savedAssets}`);

      // Write per-embed manifest
      fs.writeFileSync(path.join(embedDir, 'manifest.json'), JSON.stringify({
        url: src, title, slug, capturedAt: new Date().toISOString(),
        info, services, unknownExternal,
        networkCounts: Object.fromEntries(Object.entries(cats).map(([k,v])=>[k,v.length])),
        assets: assetManifest,
      }, null, 2), 'utf8');

      Object.assign(report, { info, services, unknownExternal, assetManifest, htmlSize: html.length });

    } catch (err) {
      console.error(`   ERROR: ${err.message}`);
      report.error = err.message;
    }

    embedReports.push(report);
    await embedCtx.close();
    console.log();
  }

  // ── Step 3: Full icon audit ───────────────────────────────────────────────
  console.log('━━ Auditing feature card icons…');
  const iconCtx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const iconPage = await iconCtx.newPage();
  await iconPage.goto(TARGET_URL, { waitUntil: 'load', timeout: 90000 });
  await iconPage.waitForTimeout(3000);
  await slowScroll(iconPage);

  const iconAudit = await iconPage.evaluate(() => {
    // Collect every UGC SVG (these are user-uploaded icons in Wix)
    const ugcAll = [...document.querySelectorAll('svg[data-type="ugc"]')];

    const icons = [];
    ugcAll.forEach((svg, idx) => {
      const rect = svg.getBoundingClientRect();
      // Nearest text context (card label)
      let context = '';
      let el = svg.parentElement;
      for (let j = 0; j < 12 && el; j++) {
        const t = el.textContent?.trim().replace(/\s+/g, ' ');
        if (t && t.length > 3 && t.length < 120) { context = t; break; }
        el = el.parentElement;
      }
      icons.push({
        idx,
        svgContent: svg.outerHTML,
        width:      Math.round(rect.width),
        height:     Math.round(rect.height),
        visible:    rect.width > 0 && rect.height > 0,
        bbox:       svg.getAttribute('data-bbox') || null,
        ariaLabel:  svg.getAttribute('aria-label') || svg.querySelector('title')?.textContent || null,
        context:    context.slice(0, 100),
      });
    });

    return {
      totalUgcSvgs:    ugcAll.length,
      totalSvgs:       document.querySelectorAll('svg').length,
      icons,
    };
  });

  await iconCtx.close();

  console.log(`   Total SVGs on page     : ${iconAudit.totalSvgs}`);
  console.log(`   UGC (icon) SVGs        : ${iconAudit.totalUgcSvgs}`);

  // Load content fingerprints of icons already on disk
  const existingIconFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'));
  const existingFingerprints = new Set(
    existingIconFiles.map(f => {
      try { return fs.readFileSync(path.join(ICONS_DIR, f), 'utf8').replace(/\s+/g, '').slice(0, 400); }
      catch { return ''; }
    }).filter(Boolean)
  );

  // Deduplicate by content
  const seenContent = new Set();
  const iconReport  = [];
  let newlySaved    = 0;

  iconAudit.icons.forEach(icon => {
    const fingerprint = icon.svgContent.replace(/\s+/g, '').slice(0, 400);
    if (seenContent.has(fingerprint)) {
      iconReport.push({ ...icon, status: 'duplicate-on-page' });
      return;
    }
    seenContent.add(fingerprint);

    if (existingFingerprints.has(fingerprint)) {
      iconReport.push({ ...icon, status: 'already-saved' });
      return;
    }

    // New icon — save it
    const label    = (icon.ariaLabel || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || null;
    const num      = String(newlySaved + 1).padStart(2, '0');
    const filename = `icon-ugc-${num}${label ? '-' + label : ''}.svg`;
    const dest     = path.join(ICONS_DIR, filename);
    fs.writeFileSync(dest, icon.svgContent, 'utf8');
    existingFingerprints.add(fingerprint);
    newlySaved++;
    iconReport.push({ ...icon, status: 'saved', filename });
    console.log(`   Saved: ${filename}  (${icon.width}×${icon.height}, ${icon.visible?'visible':'hidden'}) — ${icon.context.slice(0,50)}`);
  });

  const uniqueCount    = iconReport.filter(i => i.status !== 'duplicate-on-page').length;
  const alreadySaved   = iconReport.filter(i => i.status === 'already-saved').length;
  console.log(`   Unique icons: ${uniqueCount}  |  already in icons/: ${alreadySaved}  |  new: ${newlySaved}`);

  await browser.close();

  // ── Step 4: Append to inventory.md ───────────────────────────────────────
  console.log('\nAppending to inventory.md…');
  const md = ['\n---\n', '## Iframe Embed Details', `\n_Captured: ${new Date().toISOString()}_`];

  embedReports.forEach((r, i) => {
    md.push(`\n### Embed ${i+1} — \`${r.slug}\``);
    md.push(`- **URL:** \`${r.src}\``);
    md.push(`- **iframe \`title\` attr:** ${r.title || '_(none)_'}`);

    if (r.error) {
      md.push(`- **ERROR loading embed:** ${r.error}`);
      return;
    }

    const inf = r.info;
    md.push(`- **Page \`<title>\`:** ${inf.title || '_(empty)_'}`);
    md.push(`- **HTML size:** ${(r.htmlSize/1024).toFixed(1)} KB`);

    if (inf.headings.length) md.push(`- **Headings:** ${inf.headings.slice(0,6).map(h=>`"${h}"`).join(' · ')}`);
    if (inf.bodyText) md.push(`- **Visible text (first 400 chars):** "${inf.bodyText.slice(0, 400)}"`);

    md.push(`- **Contains:** canvas=${inf.hasCanvas} · svg=${inf.hasSvg} · video=${inf.hasVideo} · table=${inf.hasTable} · map=${inf.hasMap}`);

    if (inf.formFields.length) {
      md.push(`- **Form fields:** ${inf.formFields.map(f=>`\`${f.tag}[type=${f.type}]\``).join(', ')}`);
    }

    md.push('');
    if (r.services.length) {
      md.push('**External services / libraries detected:**');
      r.services.forEach(s => md.push(`- **${s.label}** — \`${s.url.slice(0,120)}\``));
    } else {
      md.push('_No known external services detected in network traffic._');
    }

    if (r.unknownExternal.length) {
      md.push('\n**Other external requests:**');
      r.unknownExternal.slice(0, 15).forEach(u => md.push(`- \`${u.slice(0,120)}\``));
    }

    const goodAssets = r.assetManifest.filter(a => !a.error);
    if (goodAssets.length) {
      md.push(`\n**Downloaded sub-assets (${goodAssets.length}):**`);
      md.push('| File | Size | Type | URL |');
      md.push('|------|------|------|-----|');
      goodAssets.forEach(a => {
        const type = resourceType(a.url);
        const size = `${((a.bytes||0)/1024).toFixed(1)} KB`;
        md.push(`| \`${a.filename}\` | ${size} | ${type} | \`${a.url.slice(0,100)}\` |`);
      });
    }
    md.push(`\n_Saved to: \`baseline/embeds/${r.slug}/\`_`);
  });

  // Icon audit section
  md.push('\n---\n', '## Feature Card Icon Audit');
  md.push(`| Metric | Count |`);
  md.push(`|--------|-------|`);
  md.push(`| Total SVGs on page | ${iconAudit.totalSvgs} |`);
  md.push(`| UGC (user-uploaded) SVGs | ${iconAudit.totalUgcSvgs} |`);
  md.push(`| Unique UGC icons | ${uniqueCount} |`);
  md.push(`| Already in baseline/icons/ | ${alreadySaved} |`);
  md.push(`| Newly saved this run | ${newlySaved} |`);

  const savedIcons = iconReport.filter(i => i.status === 'saved');
  if (savedIcons.length) {
    md.push('\n**Newly saved icons:**');
    md.push('| Filename | W×H | Visible | Context (card label) |');
    md.push('|----------|-----|---------|----------------------|');
    savedIcons.forEach(ic => md.push(`| \`${ic.filename}\` | ${ic.width}×${ic.height} | ${ic.visible?'yes':'no'} | ${ic.context.replace(/\|/g,'_').slice(0,70)} |`));
  }

  const alreadyIcons = iconReport.filter(i => i.status === 'already-saved');
  if (alreadyIcons.length) {
    md.push('\n**Icons already on disk (skipped):**');
    md.push('| W×H | Visible | Context |');
    md.push('|-----|---------|---------|');
    alreadyIcons.forEach(ic => md.push(`| ${ic.width}×${ic.height} | ${ic.visible?'yes':'no'} | ${ic.context.replace(/\|/g,'_').slice(0,80)} |`));
  }

  fs.appendFileSync(INVENTORY, md.join('\n') + '\n', 'utf8');
  console.log('  → inventory.md updated');

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EMBED CAPTURE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  embedReports.forEach(r => {
    if (r.error) {
      console.log(`  ${r.slug}: ERROR — ${r.error}`);
    } else {
      const svcs   = r.services.map(s=>s.label).join(', ') || 'none';
      const assets = r.assetManifest.filter(a=>!a.error).length;
      console.log(`  ${r.slug}: ${(r.htmlSize/1024).toFixed(1)} KB HTML, ${assets} assets, services: ${svcs}`);
    }
  });
  console.log(`  Icon audit: ${iconAudit.totalUgcSvgs} UGC total · ${uniqueCount} unique · ${newlySaved} new saved`);
  console.log(`  Total icons in baseline/icons/ now: ${fs.readdirSync(ICONS_DIR).filter(f=>f.endsWith('.svg')).length}`);
})();
