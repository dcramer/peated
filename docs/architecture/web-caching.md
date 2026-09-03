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

Do not rely on client-side rendering to hide private controls in shared cached
HTML. Do not assume `Vary: Cookie` survives Next.js rendering unless production
headers prove it.

## Public Data

- `publicStats.server.ts` caches anonymous counts for one hour. Server reads use
  `getPublicStats`; browser reads use `/api/stats`, backed by the same cache.
  The endpoint sends `no-store` to avoid an extra HTTP cache lifetime.
- `publicCatalog.server.ts` caches anonymous entity summaries and first-page
  entity/series bottle lists for five minutes. Keys include entity, series,
  distillery view, sort, and limit. Members, searches, extra filters, later
  pages, and unscoped lists bypass this cache.
- Read sessions outside shared cache callbacks; use anonymous clients inside.
- Keep canonical details and edit reads fresh. Anonymous page frames reuse
  canonical details; member frames fetch personalized state separately.
- Next may serve old data while refreshing. Public lists and totals can lag
  edits until refresh succeeds; mutations do not invalidate these caches.
  Preserve overview hydration and loading space when changing data loading.

## Shared HTML Caching

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
