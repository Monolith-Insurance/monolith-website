# Security Review — Monolith Website (D4)

**Date:** 2026-11-18
**Reviewer:** Claude Code / Nabil Karimi
**Branch:** `docs/security-review`

---

## 1. Scope

Only `site/` is deployed to Azure Static Web Apps (free tier, HTTPS enforced by platform).

- `baseline/` — saved reference copy of the old Wix page; never deployed.
- `scripts/` — local capture and tooling scripts; never deployed.

All findings below apply exclusively to the deployed `site/` tree unless noted otherwise.

---

## 2. Security Headers

Headers observed on `GET https://witty-hill-00fc4260f.3.azurestaticapps.net` (2026-11-18):

| Header | Value | Status |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Present |
| `X-Content-Type-Options` | `nosniff` | Present |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Present |
| `X-Frame-Options` | `SAMEORIGIN` | Present |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Present |
| `Content-Security-Policy-Report-Only` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self' data:; connect-src 'self' https://tiles.openfreemap.org https://dcgkpxkbfpqqpxhiqbaq.supabase.co; worker-src blob:; frame-src 'self'; media-src 'self'` | Present (report-only) |
| `X-Robots-Tag` | `noindex, nofollow` | Present (intentional pre-launch) |
| `Content-Security-Policy` (enforced) | — | **Missing** — CSP is report-only only |

Additional headers present but not in scope: `X-XSS-Protection: 1; mode=block` (legacy, harmless), `X-DNS-Prefetch-Control: off`.

**Missing / notable gap:** No enforced `Content-Security-Policy`. The report-only policy is in place to collect violation data before enforcement. See open items.

---

## 3. Dependencies

- Dependabot: **0 open alerts**.
- The deployed site has no npm dependencies. All JavaScript (MapLibre GL) and fonts are self-hosted static files under `site/assets/vendor/` and `site/assets/fonts/`. No CDN fetches for scripts or styles.

---

## 4. Code Scanning (CodeQL)

**8 total alerts; 0 in `site/`.**

| Alert | File | Disposition |
|---|---|---|
| Insecure randomness (1) | `baseline/index.html` | Dismissed — saved copy of Wix page, not deployed |
| Incomplete URL substring sanitization (6) | `scripts/capture-baseline.js` | Dismissed — local capture script, not deployed |
| (closed automatically) (1) | `scripts/capture-embeds.js` | Closed — file removed |

No CodeQL findings in `site/`.

---

## 5. Secrets

- Secret scanning and push protection: **enabled**.
- **0 open alerts.**
- No secrets committed to the repository.
- The Supabase anon key is a public, read-only key. It is referenced in `site/embeds/embed-03/` as a placeholder (`SUPABASE_ANON_KEY_REDACTED`) and injected at deploy time from a GitHub Actions secret. It is never committed.

---

## 6. Third-Party Network Calls from the Deployed Site

The following external hosts are contacted at runtime by `site/`:

| Host | Purpose | Location |
|---|---|---|
| `tiles.openfreemap.org` | Map tile raster/vector data for the field map | `site/embeds/embed-03/index.html` |
| `dcgkpxkbfpqqpxhiqbaq.supabase.co` | `public_walk_stats` RPC (read-only walk stats) | `site/embeds/embed-03/index.html` |
| `app.monolithrisk.com` | Client Login link (user navigation, no fetch) | `site/index.html` |

`www.monolithrisk.com` appears only in `<meta>` canonical/OG tags — it is not fetched at runtime.

No analytics, tracking pixels, or third-party scripts are loaded.

---

## 7. Contact Form

The contact form includes a honeypot field to deter basic bot submissions. The backend sending function is pending email service approval and has not been wired up. **The form must not go live without confirmed, working email delivery.** Submissions that silently fail are not acceptable.

---

## 8. Open Items (for Tyler)

1. **Supabase RLS** — confirm that the anon role is restricted to the `public_walk_stats` RPC only, with no read access to other tables.
2. **Enforce CSP** — once the report-only policy produces no violations after cutover, promote it to an enforced `Content-Security-Policy` header. The `'unsafe-inline'` allowances for script and style should be reviewed at that point.
3. **X-Robots-Tag** — remove `noindex, nofollow` at public launch cutover.
4. **Repository visibility** — consider moving to a private repository under a GitHub Team plan to limit exposure of source, workflow configuration, and issue history.

---

## 9. Conclusion

No critical or high findings in deployed code. The `site/` tree has zero CodeQL findings, no committed secrets, no third-party script dependencies, and all standard security headers present except an enforced CSP (intentionally deferred until post-cutover). The only material pre-launch gate is confirming contact form email delivery before go-live.
