# Migration Plan — monolithrisk.com: Wix to Azure Static Web Apps

_Last updated: 2026-11-17_

---

## 1. Current site

**Structure:** Single-page site with one continuous scroll. Sections in order: Hero (full-screen video), Built to Hold, What We Do, Platform, Mission, Vision, About, What We Stand For, Contact, Footer.

**Contact form fields** (all required):
- First Name, Last Name, Company, Email, Message (textarea)

**Hero video:** `file.mp4` (10.5 MB, 1080p), hosted on Wix CDN. Poster image also on Wix CDN. Both are already downloaded to `baseline/`.

**SVG circle animation on MONOLITH:** Driven by 8 SMIL `<animate>` / `<animateTransform>` elements on an inline `<svg>`. No external library — it is self-contained in the page HTML.

**Wix motion effects:** CSS `@keyframes` declared in Wix's runtime stylesheet handle entrance animations (slide-horizontal, slide-vertical, out-in, fadeIn, bgParallax). These are Wix-proprietary; the rebuild will re-implement only the effects that are visible in the final design.

**Fonts in use:**
- `montserrat` — loaded from Google Fonts (`fonts.gstatic.com`)
- JetBrains Mono — loaded from Google Fonts (used inside Platform embeds only)
- Wix-bundled variants (`din-next-w01-light`, `helveticaneuew01`, `madefor`, `ibm-plex-sans`) are Wix infrastructure fonts and are not carried over. Body falls back to `Arial, Helvetica, sans-serif`.

Both Montserrat and JetBrains Mono woff2 files are already saved in `baseline/embeds/`.

**Icons:** 15 unique UGC SVGs saved to `baseline/icons/`. Includes the Monolith Risk Management logo SVG (two variants: 38×47 and 39×49).

**SEO / meta tags** (source: `baseline/meta.json`):
- `<title>`: Monolith Risk Management | Strength in Structure
- `<meta name="description">`: Monolith is a risk management practice built by operators: one program, one proprietary platform and one team managing risk across the whole portfolio, all year.
- `<link rel="canonical">`: `https://www.monolithrisk.com`
- Open Graph: title, description, image (2500×1330 PNG on Wix CDN), url, site_name (`Monolith Risk Mgmt`), type (`website`)
- Twitter Card: `summary_large_image`, title, description, image (same OG image)
- `viewport`: `width=device-width, initial-scale=1`
- Favicon: PNG on Wix CDN (192×192), already downloaded to `baseline/`
- Remove: `generator: Wix.com Website Builder`, `skype_toolbar`, `format-detection: telephone=no` (not needed)

**Analytics / tracking:** None detected. No GA, no Meta Pixel, no tag manager firing network requests.

**Client Login link:** `<a href="https://app.monolithrisk.com/">CLIENT LOGIN</a>` in the nav. Points to the separate client portal — do not touch.

**Platform section iframes:** Three Wix-hosted embeds loaded via `<iframe>`:
1. `embed-01` — code example (canvas-based, Montserrat font)
2. `embed-02` — "MONOLITH PLATFORM CLIENT VIEW" dashboard/compliance/coverage screenshot slider (JetBrains Mono + Montserrat, Wix-hosted images)
3. `embed-03` — "IN THE FIELD" MapLibre field map (see Section 2)

All three embed HTML files are saved to `baseline/embeds/`. Their sub-assets (fonts, images, JS, CSS) are also saved.

---

## 2. Platform embeds

The Platform section contains three iframes. All three are served from `46c26bda-3870-4f23-a36b-f08242124a9c.filesusr.com`, which is Wix's embed hosting domain. Those URLs will go dark when Wix is shut down. All three embed HTML files must be copied into the repo and served from Azure. Every asset they load from `static.wixstatic.com`, `filesusr.com`, or `unpkg.com` must also be self-hosted for the same reason. Google Fonts (`fonts.gstatic.com`) and OpenFreeMap tiles are third-party services that stay up after Wix shutdown and do not need to be self-hosted, but the font files are small and already saved, so they are self-hosted anyway to remove the external dependency.

---

### embed-01 — code example

A 3 KB canvas-based HTML embed. Renders the hero video through a canvas element and overlays "MONOLITH / STRENGTH IN STRUCTURE" text using the difference blend mode. Loads Montserrat from Google Fonts.

**Assets already saved:**
- `baseline/embeds/embed-01-.../assets/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.woff2` — Montserrat (34.7 KB)
- `baseline/videos/file.mp4` — the video src (`video.wixstatic.com/…/file.mp4`) is the same 1080p file used as the hero video, already saved there. No separate copy is needed; the rebuild will reference one shared asset. No poster attribute is set.

**Assets not yet saved:** None. All sub-assets are accounted for.

**Migration steps:**
1. Copy `embed-01` HTML into the repo. Update the Google Fonts reference to use the self-hosted woff2.
2. Update the `<video src>` to point at the shared hero video asset path.

---

### embed-02 — platform client view

A 3.3 KB HTML embed showing a screenshot slider: Dashboard, Compliance Scorecard, Coverage Analysis. Loads JetBrains Mono and Montserrat from Google Fonts, and three images from `static.wixstatic.com`.

**Assets already saved in `baseline/embeds/embed-02-.../`:**
- `tDbv2o-...woff2` — JetBrains Mono (30.2 KB)
- `JTUSjIg1_...woff2` — Montserrat (34.7 KB)
- `dashboard.jpg` — 78.2 KB (originally `0bb9d6_28a634794e05458284d940d1b3ec3030~mv2.jpg`)
- `compliance.jpg` — 77.8 KB (originally `0bb9d6_a397dd5ef18e45d8a1494836f640200f~mv2.jpg`)
- `analysis.jpg` — 50.4 KB (originally `0bb9d6_a86dd8094bee44adb5647d73f050a239~mv2.jpg`)

**Assets not yet saved:** None. All sub-assets are captured.

**Migration steps:**
1. Copy `embed-02` HTML into the repo. Update all `static.wixstatic.com` image URLs to self-hosted paths. Update Google Fonts references to use the self-hosted woff2 files.

---

### embed-03 — field map ("In the Field")

A 36 KB HTML embed rendering a MapLibre WebGL map with 337 hardcoded property markers and live walk-count stats from Supabase.

**Data sources:**

| Source | What it provides | How it arrives |
|--------|-----------------|----------------|
| Hardcoded JS array `P` in embed HTML | 337 property rows: city, state, lat/lng, unit count, walk flag | Static — baked into page source at publish time |
| Supabase RPC `public_walk_stats` | Walk-count delta added to baseline constant `WBASE = 628`; per-city walk count augments for map tooltips | Live POST on page load, anon key, read-only |

**Supabase details:**
- Project URL: in `baseline/embeds/embed-03-.../index.html` line 44 (redacted here)
- Key type: `anon` (public, browser-safe, subject to RLS)
- Key issued 2026-05-28, expires 2036-05-28
- One RPC call only: `POST /rest/v1/rpc/public_walk_stats {}` — returns `{ total: <int>, cities: [{c, s, n}] }`
- No table reads, no writes, no auth, no realtime

**Assets already saved in `baseline/embeds/embed-03-.../`:**
- `maplibre-gl.js` — 917.3 KB (from `unpkg.com/maplibre-gl@5.6.0`)
- `maplibre-gl.css` — 67.8 KB (from `unpkg.com/maplibre-gl@5.6.0`)
- `JTUSjIg1_...woff2` — Montserrat (34.7 KB)
- `tDbv2o-...woff2` — JetBrains Mono (30.2 KB)
- `ofm.png` — OpenFreeMap sprite sheet (48.3 KB)
- `ofm.json` — OpenFreeMap sprite manifest (27.1 KB)

**Assets not yet saved:** None. All sub-assets are captured. Map tiles (`.pbf`) are served live by OpenFreeMap and are not downloaded — they continue to load from `tiles.openfreemap.org` after migration.

**Migration steps:**
1. Copy `embed-03` HTML into the repo. Keep the Supabase RPC call and anon key unchanged — it is a public browser key by design.
2. The anon key is injected at build time via a GitHub Actions secret (`SUPABASE_ANON_KEY`). It is never committed to the repo. The workflow substitutes a placeholder in the embed HTML before deploy.
3. Replace the two `unpkg.com` references with self-hosted paths:
   - `maplibre-gl.js` → `/assets/vendor/maplibre-gl.js`
   - `maplibre-gl.css` → `/assets/vendor/maplibre-gl.css`
4. Update Google Fonts references to use the self-hosted woff2 files.
5. The hardcoded property array `P` stays in the embed HTML. No database work required.

---

## 3. Target setup

**Stack:** Plain HTML, CSS, JS. No framework, no build tool required beyond the GitHub Actions deploy step.

**Hosting:** Azure Static Web Apps, free tier.
- Resource group: `rg-monolith-website`
- Subscription: `MonolithRisk-App` (pending confirmation — see Section 9)
- Region: select closest to majority of users (default: East US 2)

**CI/CD:** GitHub Actions workflow generated by Azure Static Web Apps on resource creation. Deploys from `main` branch on push. Note: the Azure portal normally commits the generated workflow file directly to `main`, which branch protection blocks. Instead, the workflow file will be added via a pull request. The Static Web Apps deployment token is stored as a GitHub Actions secret and referenced in the workflow.

**Repo:** `Monolith-Insurance/monolith-website` (currently public — see Section 10 for future move to private).

**Configuration file:** `staticwebapp.config.json` at repo root handles routing, security headers, and 404 fallback (see Section 5).

---

## 4. Contact form

The static site has no server-side runtime. The contact form requires a backend to process submissions.

**Approach:** Azure Static Web Apps managed function (Node.js HTTP trigger) at `/api/contact`. It receives the five form fields (First Name, Last Name, Company, Email, Message), validates them, and forwards to the destination Steven confirms.

**Destination:** Build the form and function now; connect the destination once Steven confirms. Preferred option: **Azure Communication Services** (Email) — stays within the company's Azure account, no third-party dependency. Alternatives: SendGrid, Resend, direct SMTP, or an internal inbox via webhook. Any option with a paid plan requires written approval before the account is created.

**Spam protection:**
- Hidden honeypot field in the HTML form. If the field is populated on submission, the function returns 200 silently and discards the submission.
- Basic rate limiting on `/api/contact`: no more than 5 submissions per IP per 10 minutes, enforced in the function. Excess requests return 429. This is best-effort — managed function instances do not share memory, so a burst across multiple cold instances can exceed the limit. It stops unsophisticated abuse; it is not a substitute for a proper rate-limiting layer if abuse becomes a problem.

**Secrets:** Destination endpoint URL, API key, and any recipient address are stored as Static Web Apps application settings (environment variables), not in code or in the repo.

---

## 5. Security

- **HTTPS:** Enforced automatically by Azure Static Web Apps. HTTP redirects to HTTPS.
- **Security headers** in `staticwebapp.config.json`:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (note: the Platform iframes are same-origin once self-hosted; if any embed is cross-origin, use `Content-Security-Policy` `frame-ancestors` instead)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), camera=(), microphone=()`
  - `Content-Security-Policy`: to be drafted once all asset URLs are confirmed
- **No secrets in the repo:** Supabase anon key and form destination keys are GitHub Actions secrets / Static Web Apps app settings only.
- **Dependabot:** Done — enabled at the repo level for GitHub Actions workflows and npm.
- **Secret scanning with push protection:** Done — enabled at the repo level. Blocks any accidental key commit at push time.
- **CodeQL:** Done — enabled at the repo level. Default query suite covers JS/TS.
- **Branch protection on `main`:** Done — enabled with: require pull request, block force pushes, restrict deletions.

---

## 6. Cutover

**Before cutover:**

1. Roy lowers DNS TTL to 300 seconds (5 min) in GoDaddy at least 24 hours before the window. This ensures old records expire quickly if rollback is needed.
2. Add custom domains in Azure Static Web Apps: `www.monolithrisk.com` and `monolithrisk.com` (bare domain — see Section 7). Azure issues a free managed TLS certificate once each domain is verified.
3. Roy adds the TXT validation records Azure provides to GoDaddy so both domains are verified ahead of the cutover window. Do not wait until the cutover day to do this.
4. Validate the Azure-assigned domain (`<name>.azurestaticapps.net`) against a staging checklist: all sections render, video plays, map loads, form submits, Client Login link works.

**During cutover:**

5. Roy updates only the `www` CNAME and root record in GoDaddy to point at Azure (exact values from Azure portal). MX, SPF, DKIM, and all other email and application records are not touched. `app.monolithrisk.com` is not touched at any point.

**After cutover:**

6. Verify the live site at `www.monolithrisk.com`: scroll all sections, submit a test contact form, confirm the field map loads and walk stats display.
7. Monitor for 30 minutes. If anything is broken, execute rollback (Section 8).
8. Confirm `app.monolithrisk.com` is still reachable and unaffected.

**Target downtime:** Under 2 hours (realistically near-zero with low TTL — users see one host or the other, not a gap).

**Suggested window:** A Tuesday morning (09:00–11:00 local), avoiding Thanksgiving week (week of 2026-11-23) and Fridays.

---

## 7. Root domain

GoDaddy does not support a true CNAME (ALIAS/ANAME) on the bare apex (`monolithrisk.com`) for all plan types. Options:

| Option | How it works | Tradeoff |
|--------|-------------|----------|
| **A record pointing to Azure IP** | GoDaddy A record → Azure Static Web Apps public IP | Azure IPs can change; requires monitoring |
| **Redirect apex to www in GoDaddy** | GoDaddy URL forwarding: `monolithrisk.com` → `https://www.monolithrisk.com` | Simple; GoDaddy handles it; `www` is canonical. Confirm that `https://monolithrisk.com` redirects correctly over HTTPS, not just HTTP — GoDaddy's forwarding behavior on HTTPS varies by plan. |
| **Domain forwarding with masking (avoid)** | Wraps site in a frame | Breaks SEO, do not use |
| **Transfer DNS to Cloudflare** | Cloudflare supports CNAME flattening at apex | A nameserver change moves every DNS record on the domain — including MX, SPF, DKIM, and `app.monolithrisk.com` — to Cloudflare. All records must be recreated there first. This carries the most risk of the available options. |

Decide with Roy once the current DNS records are in hand. Recommended default: GoDaddy redirect apex → `www`, keep `www` as the canonical URL (already set in `<link rel="canonical">`).

---

## 8. Rollback

If anything is wrong after cutover:

1. Roy restores the previous GoDaddy DNS records to point `www` and the root back to Wix. With a 5-minute TTL, propagation completes in under 10 minutes for most users.
2. No Azure resources need to be deleted for rollback — the Static Web Apps instance stays up.
3. Wix subscription remains active until Tyler approves shutdown timing and Devon authorizes it. Do not cancel Wix until the site has been stable on Azure for an agreed period.

---

## 9. Open items

| Item | Owner | Needed by |
|------|-------|-----------|
| Contact form destination (email service, inbox, or webhook) | Steven | Before D5 form wiring |
| Schedule Steven's staging review | Steven | Before end of D5 |
| Current DNS records for `monolithrisk.com` (export from GoDaddy) | Roy | Before cutover planning |
| Confirm whether any Wix URL redirects exist (e.g. short URLs or vanity paths) that need to be recreated | Wix owner | Before cutover |
| Supabase RLS check — confirm anon role is restricted to `public_walk_stats` only, no table access | Tyler | Before go-live |
| Confirm whether publishing property coordinates and unit counts (the 337-row array) in public page source is intended | Tyler | Before go-live |
| Confirm `MonolithRisk-App` as the target Azure subscription | Devon | Before D4 resource creation |

---

## 10. Future items (out of scope for this migration)

These are not part of the current engagement. Each requires separate approval before work begins.

1. **Move repo to private** — Requires GitHub Team plan on `Monolith-Insurance` org. Note: the same property data is visible on the live public site regardless of repo visibility, so a private repo only hides the source files, not the data itself.
2. **Rotate the Supabase anon key** — The current key expires 2036. Before rotating, confirm whether `app.monolithrisk.com` uses the same Supabase project; if it does, the app must be updated simultaneously or it will break.
3. **Move the property array to a managed dataset** — Extract `P` from the embed HTML into a versioned JSON file in Azure Blob Storage or a database table so portfolio data can be updated without a code deploy.
4. **Replace the Supabase RPC with an Azure Function** — Re-implement `public_walk_stats` as an Azure Function backed by an Azure data store, eliminating the Supabase dependency entirely. Requires migrating the walk-completion data.

---

## 11. Hour budget by deliverable

| Deliverable | Scope | Est. hours |
|------------|-------|-----------|
| D1–D3 | Assessment and migration plan, Wix reference baseline, GitHub baseline (repo, branch protection, security scanning) | ~2 (complete) |
| D4 | Azure staging (resource group, Static Web App, GitHub Actions deploy), security headers, focused security review | 1–1.5 |
| D5 | Exact replica of the site on staging, including the Platform embed and contact form, for Steven's review | 2.5–3 |
| Review fixes | One round of changes from Steven's review | 0.5 |
| D6 | Production cutover: custom domains, DNS with Roy, verification, rollback test | 0.75–1 |
| D7 | Live-site verification, basic runbook, outstanding-items list, walkthrough with Tyler | 1 |
| Reporting | Weekly updates and mid-week checkpoint | 0.75 |
| Total | | under 10 |
