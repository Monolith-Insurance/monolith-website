# Supabase Audit — monolithrisk.com Field Map Embed

_Source file: `baseline/embeds/embed-03-373ccc681b45f42ed333d4b64e6b11b9/index.html`_
_Audited: 2026-11-17_

---

## Project

| Field | Value |
|-------|-------|
| Supabase project URL | `https://<project-id>.supabase.co` |
| Project ref (from JWT `ref` claim) | redacted — matches subdomain |
| Region | unknown (not disclosed in client code) |

> The full project URL is present in the embed source. It is omitted here. See `baseline/embeds/embed-03-…/index.html` line 44.

---

## Credential

| Field | Value |
|-------|-------|
| Key type | `anon` (public anonymous key) |
| JWT `role` claim | `anon` |
| JWT `iss` claim | `supabase` |
| Issued | 2026-05-28 |
| Expires | 2036-05-28 (10-year lifetime — standard Supabase anon key) |
| Delivery | Hardcoded in client-side JavaScript, visible in page source |

The key used is the **anon key**, not the `service_role` key. The anon key is intended for browser use and is subject to Row Level Security (RLS) policies on the Supabase side. It cannot bypass RLS.

**Migration action:** This key is already publicly exposed in the embed source and must be treated as public. When migrating, do not promote this key to any server-side role. Rotate if reusing the Supabase project.

---

## API Calls

### Call 1 — `public_walk_stats`

| Field | Value |
|-------|-------|
| Endpoint | `https://<project-id>.supabase.co/rest/v1/rpc/public_walk_stats` |
| HTTP method | `POST` |
| Request body | `{}` (no parameters) |
| Auth headers | `apikey` + `Authorization: Bearer` (anon key) |
| Called on | Page load (inside `try/catch`, fire-and-forget) |

This is an **RPC call** to a Postgres function named `public_walk_stats`. The `public_` prefix is a Supabase convention indicating the function is exposed to the anon role via PostgREST.

No other Supabase endpoints are called. There are no direct table endpoints (`/rest/v1/<table>`), no realtime subscriptions, no storage calls, and no auth calls.

---

## Response Shape

The function returns a single JSON object. The client consumes exactly two fields:

```
{
  total:  <integer>,          // additional walk completions beyond the hardcoded baseline
  cities: [                   // per-city walk count deltas
    { c: <city_name>,         // e.g. "Dallas"
      s: <state_abbrev>,      // e.g. "TX"
      n: <integer>            // walk count for that city
    },
    …
  ]
}
```

The `total` value is added to a hardcoded baseline constant (`WBASE = 628`) to produce the "600+ Property Walks" stat displayed in the footer bar. The `cities` array is used to augment per-city walk counts in the interactive map tooltip.

---

## Read vs. Write

**Read-only.** The only HTTP verb used is `POST` (required by PostgREST for RPC calls regardless of side effects). There are no `INSERT`, `UPDATE`, or `DELETE` operations. The function name and empty request body are consistent with a pure aggregate query. No table endpoints are called directly.

---

## Data Returned — Aggregated or Individual Records?

**Aggregated stats only.** The response contains:
- One integer (`total`) — a walk completion count
- An array of per-city summary counts (`cities`)

No individual client records, no PII, no property-level identifiers, and no financial data are returned. The map dots and unit counts come from a **hardcoded dataset baked into the embed HTML**, not from Supabase.

---

## Hardcoded Property Dataset (not from Supabase)

The embed contains a large JavaScript array `P` with one row per community:

```
[ "City, State",  lat,  lng,  unit_count,  walk_flag ]
```

| Stat | Value |
|------|-------|
| Total property rows | 337 |
| Unique city+state labels | 147 |
| Unique states | 23 |
| Total units (sum) | 66,601 |
| Rows with `walk_flag > 0` | 154 |
| States covered | AR, CA, CO, FL, GA, IL, IN, IA, KS, KY, MD, MN, MO, MT, NE, NM, NC, OK, TN, TX, VA, WA, WI |

This dataset is **static marketing data** embedded in the page source. It is not fetched at runtime and not protected by any credential. It represents Monolith's property footprint as of the embed's last publish date.

**Migration action:** Extract this array from the embed source into a managed data file (JSON or seeded database table) for the Azure build. Do not rely on the embed HTML as the source of truth for portfolio data — verify against an internal system of record.

---

## Third-Party Services Called by the Field Map

| Service | Purpose | Credential required |
|---------|---------|---------------------|
| Supabase (`public_walk_stats`) | Live walk-count delta | Anon key (public) |
| OpenFreeMap (`tiles.openfreemap.org`) | Vector map tiles (`.pbf`) | None — open/free |
| OpenFreeMap sprites | Map icon sprite sheet | None |
| MapLibre GL JS 5.6.0 (via unpkg.com) | WebGL map renderer | None |
| Google Fonts | Montserrat + JetBrains Mono | None |

---

## In-scope migration approach

The field map embed works as-is and has no dependency on Wix. The following approach requires no backend changes and no approval gate:

1. **Keep the Supabase RPC call unchanged** — the embed continues to call `public_walk_stats` on the existing Supabase project with the existing anon key. No endpoint change, no credential change.

2. **Keep the hardcoded property array (`P`) as-is** — the 337-row dataset is static marketing content baked into the embed HTML. It requires no migration work and no database on Azure.

3. **Self-host MapLibre GL JS on Azure** — replace the two `unpkg.com` references in the embed with URLs pointing to Azure Blob Storage / CDN. The files are already saved at `baseline/embeds/embed-03-…/assets/maplibre-gl.js` (917 KB) and `maplibre-gl.css` (68 KB). This removes the runtime dependency on unpkg and aligns with a no-external-CDN posture.

---

## Recommendations for future consideration (out of scope, require Tyler/Devon approval)

1. **Replace the Supabase RPC with an Azure Function** — `public_walk_stats` could be re-implemented as an Azure Function (HTTP trigger) backed by Azure SQL or Cosmos DB, with the same response shape (`{ total, cities }`). This would eliminate the Supabase dependency entirely but requires migrating the underlying walk-completion data.

2. **Rotate the anon key** — The current key has a 10-year lifetime and is visible in public page source. Before rotating, confirm whether `app.monolithrisk.com` (the client portal) uses the same Supabase project — if it does, rotating the anon key will break any browser-side queries the app makes unless it is updated simultaneously.

3. **Extract the property array into a managed dataset** — Store the `P` array as a versioned JSON file in Azure Blob Storage or a database table so the portfolio footprint can be updated without editing and redeploying the embed HTML.

4. **Confirm Supabase RLS scope** — Verify in the Supabase dashboard that Row Level Security restricts the anon role to `public_walk_stats` only, and that no tables or other RPC functions are accessible to anon without authentication. This confirms the blast radius of the publicly exposed key.
