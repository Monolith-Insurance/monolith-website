# Deployment

## How deploys work

The site is hosted on Azure Static Web Apps and deployed via GitHub Actions.

- **Merge to `main`** triggers a production deploy automatically. The site is live within a couple of minutes of the merge completing.
- **Pull requests** targeting `main` automatically get a preview (staging) URL posted as a PR comment by the Azure bot. The preview is torn down when the PR is closed.

The workflow file is at `.github/workflows/azure-static-web-apps.yml`.

## Secrets

| Secret | Where to set it | Purpose |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | GitHub repo → Settings → Secrets → Actions | Authorizes the GitHub Actions runner to deploy to the Azure Static Web App. Rotate this in the Azure portal under the Static Web App resource → Manage deployment token. |
| `SUPABASE_ANON_KEY` | GitHub repo → Settings → Secrets → Actions | Optional. If set, the placeholder `SUPABASE_ANON_KEY_REDACTED` in `site/embeds/embed-03/index.html` is replaced with this value before deploy. Without it, the map and property dots still display, but live walk counts do not load. |

## Contact form

The form at `/api/contact` sends email via Azure Communication Services (ACS). Three app settings must be configured before it will work. Until they are set the function returns `503` and the form shows an error message — it will never show a false success.

| App setting | Value | Notes |
|---|---|---|
| `ACS_CONNECTION_STRING` | ACS resource → Keys → Connection string | Keep this secret; never commit it. |
| `CONTACT_TO_EMAIL` | `hello@monolithrisk.com` | Where contact submissions are delivered. |
| `CONTACT_FROM_EMAIL` | DoNotReply address from the ACS Email domain | e.g. `DoNotReply@<domain>.azurecomm.net` — found in ACS → Email → Domains. |

**Where to set them:** Azure portal → Static Web App resource → Settings → Environment variables → Add.

## Cutover (completed 2026-11-20)

- `www` CNAME points to `witty-hill-00fc4260f.3.azurestaticapps.net`.
- Bare domain (`monolithrisk.com`) forwards to `https://www.monolithrisk.com` (301) via GoDaddy.
- `noindex` header removed from `site/staticwebapp.config.json`.

**Remaining:** promote the report-only CSP to enforced once no violations appear.
