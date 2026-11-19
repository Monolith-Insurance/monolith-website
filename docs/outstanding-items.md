# Outstanding Items

_For Tyler. Last updated: 2026-11-19._

| Item | Why | Owner | Priority |
|---|---|---|---|
| Retire Wix | Wix is the rollback path. Keep it active until Tyler approves timing and Devon authorises the shutdown. Do not cancel before the site has been stable on Azure for an agreed period. | Devon / Tyler | High |
| Export Wix contact list before shutdown | Any contacts collected through the Wix form will be lost when Wix is shut down. Export the list if it is needed. | Steven | High |
| Confirm Supabase RLS restricts anon role to `public_walk_stats` only | The anon key is public and browser-exposed. If RLS is misconfigured, it could allow reads on other tables. Verify in the Supabase dashboard that no tables or other RPC functions are accessible to the anon role. Also: the anon key likely belongs to the same Supabase project as `app.monolithrisk.com` — confirm this before rotating the key, because rotating it would break the app unless both are updated simultaneously. | Tyler | High |
| Confirm that publishing property coordinates and unit counts on the public map is intended | The map embed contains a hardcoded array of 337 properties with lat/lng, city, state, and unit count. This data is visible in the page source of the public site. Confirm this is intentional before launch. | Tyler / Steven | High |
| Confirm no other images or icons came from Wix's media library | All known assets have been accounted for, but verify that no images or icons in the site were sourced from `static.wixstatic.com` and are still loading from there. These will break when Wix is shut down. | Steven | High |
| Enforce the Content Security Policy | The CSP is currently in report-only mode. Once the site has been live with no violations logged, promote it to an enforced `Content-Security-Policy` header in `site/staticwebapp.config.json`. | Tyler | Medium |
| Remove contractor access after handoff | Remove contractor GitHub org owner role and Azure resource roles once the walkthrough is done and handoff is complete. | Tyler / Devon | Medium |
| Update `actions/checkout` to v5 in the workflow | The current workflow uses an older version that triggers a Node 20 deprecation warning in GitHub Actions. It works today but will need updating. File: `.github/workflows/azure-static-web-apps.yml`. | Tyler | Medium |
| Retire or archive the old monolith-site repo | There is a separate `monolith-site` repo under the `monolithrisk` personal account. Archive or delete it to avoid confusion. | Tyler | Low |
| Move other repos from the monolithrisk personal account into the Monolith-Insurance org | Consolidating repos under the org makes access control and billing easier to manage. | Tyler | Low |
| Consider a private repo with GitHub Team | The current repo is public. Moving to private (requires GitHub Team plan on the org) would hide source files, workflow config, and issue history. Note: the property data on the map is public regardless of repo visibility. | Tyler / Devon | Low |
| Consider tightening DMARC from `p=none` | Once email is confirmed healthy and no legitimate senders are being missed, raise the DMARC policy to `p=quarantine` or `p=reject` to prevent domain spoofing. Coordinate with Roy for the DNS change. | Tyler | Low |
| Optional: send contact form emails from an `@monolithrisk.com` address | Submissions currently come from a DoNotReply `azurecomm.net` address and may land in junk. Sending from a branded address requires adding a custom domain to Azure Communication Services and a few DNS records (Roy). | Tyler / Roy | Low |
| Note: map depends on Supabase | If `monolith-app`'s Supabase project is ever migrated or shut down, the field map in the Platform section will stop loading walk stats. Update `site/embeds/embed-03/index.html` and the `SUPABASE_ANON_KEY` GitHub secret at the same time. | Tyler | Low |
| Note: contact form rate limiting is best-effort | The `/api/contact` function limits to 5 submissions per IP per 10 minutes, but Azure managed function instances do not share memory. A burst across cold instances can exceed the limit. It stops unsophisticated abuse; it is not a substitute for a proper rate-limiting layer if abuse becomes a problem. | Tyler | Low |
| Future: add more city night videos | Additional city videos can be added using `scripts/optimize-hero-video.sh`. See `docs/runbook.md` for instructions. | Steven | Low |
| Optional cleanup: delete merged branches | After handoff, merged feature and fix branches can be deleted from the repo to keep it tidy. | Tyler | Low |
