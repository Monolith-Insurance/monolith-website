# Runbook — monolithrisk.com

_For Tyler. Last updated: 2026-11-19._

---

## Overview

`monolithrisk.com` is a static site (plain HTML/CSS/JS, no framework). It lives in the GitHub repo **Monolith-Insurance/monolith-website** (currently public) and is hosted on **Azure Static Web Apps** (free tier).

| Thing | Value |
|---|---|
| Azure resource | `swa-monolith-website` |
| Resource group | `rg-monolith-website` |
| Subscription | `MonolithRisk-App` |
| Azure Email resource | `acs-monolith-website` |
| Azure Communication Services resource | `ecs-monolith-website` |
| Canonical URL | `https://www.monolithrisk.com` |
| Bare domain | `monolithrisk.com` — forwards to `www` via GoDaddy URL forwarding |
| DNS registrar | GoDaddy (Roy) |

---

## How to make a change

1. Create a branch off `main` and edit files under `site/`.
2. Open a pull request. The Azure Static Web Apps bot posts a **preview URL** as a PR comment within a minute or two. Use it to review the change.
3. Merge the PR to `main`. Production updates automatically within a couple of minutes.

Branch protection on `main` requires a pull request — you cannot push directly.

The GitHub Actions workflow file is at `.github/workflows/azure-static-web-apps.yml`.

---

## Cache busting

`site/index.html` loads the stylesheet and JS with a version query string:

```html
<link rel="stylesheet" href="css/styles.css?v=20261119">
<script src="js/main.js?v=20261119"></script>
```

**Any time you edit `styles.css` or `main.js`, bump both `?v=` values** to today's date (e.g. `?v=20261120`). This forces browsers to fetch the updated file instead of serving a cached copy. The comment at the top of `index.html` reminds you.

---

## Hero videos

### How they work

The hero background cycles through city night videos. `site/js/main.js` holds the list in a `heroClips` array near the top of the file. When one video ends it loads the next, looping back to the start:

```js
var heroClips = [
  { r720: 'assets/videos/dallas-720.mp4',    r1080: 'assets/videos/dallas-1080.mp4' },
  { r720: 'assets/videos/milwaukee-720.mp4', r1080: 'assets/videos/milwaukee-1080.mp4' }
];
```

On screens narrower than 768 px the `-720.mp4` variant plays; wider screens use `-1080.mp4`. A hidden element preloads the next clip while the current one plays.

### How to add or replace a city video

1. **Encode the video.** You need ffmpeg installed. Run:

   ```bash
   bash scripts/optimize-hero-video.sh /path/to/raw-city-footage.mp4 cityname
   ```

   Replace `cityname` with a short slug (e.g. `chicago`). The script writes three files into `site/assets/videos/`:
   - `cityname-1080.mp4` — full-res, H.264, no audio
   - `cityname-720.mp4` — 720p, H.264, no audio
   - `cityname-poster.jpg` — still frame from ~1 second in

   ffmpeg is expected at `~/tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg`. If your machine has ffmpeg at a different path, edit the `FFMPEG` variable at the top of the script before running it.

2. **Add the clip to the rotation.** Open `site/js/main.js` and add a line to the `heroClips` array:

   ```js
   { r720: 'assets/videos/chicago-720.mp4', r1080: 'assets/videos/chicago-1080.mp4' }
   ```

   To replace a clip instead, update the existing entry (or delete it and add the new one).

3. **Bump the JS cache-bust version** in `site/index.html` (see Cache busting above).

4. Commit, open a PR, check the preview, merge.

The poster image for the page (`site/index.html` `poster=` attribute and OG/Twitter meta tags) currently points at `assets/videos/dallas-poster.jpg`. If you want to change which frame browsers show before the video plays, update that attribute and the two meta tag references.

---

## Contact form

The form sends to **hello@monolithrisk.com** via an Azure Function at `/api/contact` backed by Azure Communication Services (ACS).

Submissions arrive from a DoNotReply `azurecomm.net` address. They may land in junk the first few times — add the sender to the allowlist. The form only shows "Thank you" after the email is confirmed sent; it never shows a false success.

### App settings (Azure portal)

Three environment variables must be set for the form to work. Find them at:

**Azure portal → `swa-monolith-website` → Settings → Environment variables**

| Setting | What it is |
|---|---|
| `ACS_CONNECTION_STRING` | ACS resource → Keys → Connection string |
| `CONTACT_TO_EMAIL` | `hello@monolithrisk.com` |
| `CONTACT_FROM_EMAIL` | DoNotReply address in ACS → Email → Domains |

If any of these are missing the function returns `503` and the form shows an error — it will not silently swallow submissions.

---

## Secrets

Two secrets live in **GitHub repo → Settings → Secrets → Actions**:

| Secret | Purpose |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Authorises GitHub Actions to deploy. Rotate via Azure portal → `swa-monolith-website` → Manage deployment token. |
| `SUPABASE_ANON_KEY` | Injected into `site/embeds/embed-03/index.html` at deploy time (replaces the `SUPABASE_ANON_KEY_REDACTED` placeholder). Read-only public key — the map still falls back to hardcoded walk counts if this secret is absent. |

**Never commit either key to the repo.** Secret scanning with push protection is enabled and will block the push if you try.

---

## Platform map (embed-03)

The "In the Field" map in the Platform section calls the Supabase RPC `public_walk_stats` using the anon (public, read-only) key. It returns aggregated walk-count stats that augment the per-city tooltips. No PII, no table reads, no writes.

The 337 property dots and unit counts on the map come from a hardcoded array baked into `site/embeds/embed-03/index.html` — they are not fetched from Supabase at runtime.

If the monolith-app Supabase project is ever migrated or the anon key is rotated, the map embed must be updated at the same time (see outstanding items).

---

## DNS

DNS is managed in GoDaddy by **Roy**.

### Records that matter for the website

| Record | Type | Value | Notes |
|---|---|---|---|
| `www` | CNAME | Azure Static Web App hostname | Points the site to Azure |
| `_dnsauth.www` | TXT | Azure-issued validation value | Domain ownership proof — keep it, do not delete |
| `monolithrisk.com` (bare) | Forwarding | `https://www.monolithrisk.com` | GoDaddy URL forwarding; bare domain → www |

### Records that must not be touched

| Record | Type | Purpose |
|---|---|---|
| `@` | MX | Inbound email routing |
| `@` | TXT (SPF) | Email sender authentication |
| `@` | TXT (DMARC) | Email policy |
| DKIM selectors | CNAME / TXT | Email signing |
| `autodiscover` | CNAME | Outlook autodiscover |
| `app` | CNAME | `app.monolithrisk.com` — client portal; never touch |
| `asuid.app` | TXT | Azure domain verification for the client app |

Do not change any of the email or app records. The HTTPS certificate for `www.monolithrisk.com` is free and renews automatically through Azure.

---

## Rollback to Wix

If something goes wrong after cutover and Wix is still active:

1. Roy changes the `www` CNAME back to `cdn3.wixdns.net`.
2. Roy removes the GoDaddy URL forwarding on the bare domain.
3. Roy re-adds the three Wix A records to the bare domain:
   - `185.230.63.171`
   - `185.230.63.186`
   - `185.230.63.107`

Records use a 1-hour TTL, so a rollback can take up to about an hour to reach all visitors. Lowering the TTL on www ahead of time shortens this. The Azure Static Web Apps instance does not need to be touched — leave it up.

**Wix must stay active until Tyler approves shutdown timing and Devon authorizes it.**

---

## Monitoring

| What | Where |
|---|---|
| Deploy status | GitHub → Actions tab |
| Security and dependency alerts | GitHub → Security tab (currently 0 open alerts) |
| Static Web App health | Azure portal → `swa-monolith-website` |
| Email service | Azure portal → `ecs-monolith-website` |

---

## Costs

- **Azure Static Web Apps** — free tier; no charge.
- **Azure Communication Services** — billed per email sent. Pennies at current contact form volume.
