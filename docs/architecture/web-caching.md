# Web Caching

Shared HTML caching is for anonymous requests only. A signed-in user must never
receive HTML cached for another request.

## Current Design

- `apps/web/src/proxy.ts` classifies requests before rendering.
- A request with `_session` receives
  `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- Public page data uses an anonymous server client when it does not need member
  state.
- The root layout stays dynamic because the app shell can vary by session.
- Sitemap handlers can use public XML cache headers because they have no signed-
  in version.

## Public Data Snapshots

`publicStats.server.ts` owns a shared one-hour Next data cache. Homepage,
About, search, and sitemap reads use that loader. Footer and authentication
queries use `/api/stats`, which reads the same anonymous snapshot. The endpoint
uses `no-store` response headers so HTTP caching does not add another freshness
window; `asOf` continues to describe when the API counted the data.

`publicCatalog.server.ts` uses five-minute Next data revalidation for anonymous
entity catalog summaries and simple first-page entity/series bottle lists.
List keys include the entity, series, distillery view, sort, and limit. Searches,
extra filters, later pages, and unscoped lists bypass this cache. Signed-in
requests always bypass it, preserving fresh member flags and edit results.
The existing overview query keys, server hydration, and loading geometry stay
the same.

These public snapshots refresh on access after their interval; Next may serve
the previous result while refreshing it. They are not used for edit forms or
canonical detail lookups. Canonical Bottle and Entity reads remain request-time
so merged IDs still redirect immediately. Anonymous page frames reuse those
records; only member frames perform the additional personalized details read.

Public list membership and totals can lag an edit until revalidation succeeds.
There is no mutation-driven invalidation across the API and web deployment.
Do not expand these caches to private data, moderation visibility, prices,
reviews, or identity resolution without handling those freshness requirements.

Do not rely on client-side rendering to hide private controls in shared cached
HTML. Do not assume `Vary: Cookie` survives Next.js rendering unless production
headers prove it.

## Adding Shared Caching

Before adding `s-maxage` to a page:

1. Confirm that every server read is anonymous and the HTML contains no member
   data.
2. Confirm that Vercel bypasses or varies the cache for `_session`.
3. Check anonymous and signed-in response headers in production.
4. Check the page as both a visitor and a member after deploy.

```shell
curl -I https://peated.com/bottles/1
curl -I -H 'Cookie: _session=dummy' https://peated.com/bottles/1
```

Until these checks pass, keep page HTML private and request-time rendered.
