# Deployment

## How deploys work

The site is hosted on Azure Static Web Apps and deployed via GitHub Actions.

- **Merge to `main`** triggers a production deploy automatically. The site is live within a couple of minutes of the merge completing.
- **Pull requests** targeting `main` automatically get a preview (staging) URL posted as a PR comment by the Azure bot. The preview is torn down when the PR is closed.

The workflow file is at `.github/workflows/azure-static-web-apps.yml`.

## Secrets

| Secret | Where to set it | Purpose |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | GitHub repo → Settings → Secrets → Actions | Authorises the GitHub Actions runner to deploy to the Azure Static Web App. Rotate this in the Azure portal under the Static Web App resource → Manage deployment token. |
| `SUPABASE_ANON_KEY` | GitHub repo → Settings → Secrets → Actions | Optional. If set, the placeholder `SUPABASE_ANON_KEY_REDACTED` in `site/embeds/embed-03/index.html` is replaced with this value before deploy. If the secret is absent the step is skipped silently and the map embed falls back to hardcoded walk counts. |

## Cutover checklist

When switching the production domain from the `azurestaticapps.net` URL to the real domain:

1. Add the custom domain in the Azure Static Web Apps resource.
2. **Remove the `X-Robots-Tag` header** from `site/staticwebapp.config.json` (the `noindex, nofollow` value prevents Google from indexing the staging URL but must not carry over to production).
3. Confirm the `Content-Security-Policy-Report-Only` header causes no console errors on the live domain, then promote it to `Content-Security-Policy` once satisfied.
