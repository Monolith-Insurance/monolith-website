# monolith-website

This repo is the monolithrisk.com marketing website, migrated from Wix to Azure Static Web Apps in November 2026. Live at https://www.monolithrisk.com.

## Start here

| Doc | What it covers |
|---|---|
| `docs/runbook.md` | How everything works and how to make changes |
| `docs/outstanding-items.md` | Open items and owners |
| `docs/deployment.md` | Deploy and settings reference |
| `docs/security-review.md` | Security review |
| `docs/migration-plan.md` | Original pre-build plan (historical) |

## Folder map

| Folder / file | What it is |
|---|---|
| `site/` | The website. The only folder that gets deployed to Azure Static Web Apps. |
| `api/` | Azure Function that sends contact form emails via Azure Communication Services. |
| `.github/workflows/` | Automatic production deploys on merge to `main`, and CodeQL scanning. |
| `docs/` | Project documentation. |
| `scripts/capture-baseline.js` | Saved the original Wix site to `baseline/` for reference. |
| `scripts/optimize-hero-video.sh` | Encodes a raw video into the 1080p/720p H.264 files and poster image the hero uses. |
| `baseline/` | Reference capture of the original Wix site, kept for comparison. Never deployed. |

The root `package.json` is only for the capture script. It is not used by the website.

## Preview locally

```
cd site
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Make a change

See `docs/runbook.md`.

## Project timeline

| Date | What happened |
|---|---|
| 2026-11-17 | Migration plan written, Wix baseline captured, GitHub repo set up |
| 2026-11-17 | DNS moved from Wix nameservers to GoDaddy |
| 2026-11-18 | Azure staging environment, security review, contact form wired up |
| 2026-11-19 | Client review changes applied |
| 2026-11-20 | Go-live cutover — www CNAME pointed at Azure, noindex removed |
