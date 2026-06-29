# Web Caching

## Intent

Peated receives steady crawler traffic on public bottle and entity pages. We want
anonymous crawler and visitor traffic to benefit from shared HTTP/CDN caching
without ever serving shared cached HTML to authenticated users.

## Core Rule

Shared HTML caching is anonymous-only.

- Requests with `_session` must receive `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- Requests without `_session` may receive public CDN cache headers on explicitly
  approved public routes only after the hosting cache key is proven to bypass
  or vary for `_session`.
- Do not rely on personalized client hydration to make a shared cached page safe for authenticated users. Authenticated requests should bypass shared cached HTML entirely.
- `Vary: Cookie` is desirable, but Next.js may overwrite `Vary` on rendered
  App Router responses. Do not assume it is present unless production headers
  prove it.

## Next.js Cache Layers

Next.js App Router has multiple cache layers. Use the right one for the job:

- The Full Route Cache stores statically rendered route output across requests.
- The Data Cache stores cached `fetch` data.
- The Router Cache is the client-side route cache.
- Route segment config such as `dynamic`, `revalidate`, and `fetchCache` applies within the route tree, so layout-level config can affect children.

Relevant Next.js docs:

- https://nextjs.org/docs/14/app/building-your-application/caching
- https://nextjs.org/docs/14/app/api-reference/file-conventions/route-segment-config
- https://nextjs.org/docs/14/app/building-your-application/routing/middleware
- https://nextjs.org/docs/app/api-reference/file-conventions/middleware

## Page Policy

Peated's app shell can vary by authentication on almost every page. For that
reason, normal HTML pages should not use the Full Route Cache as the primary
cache. The root app layout intentionally keeps rendering dynamic, and shared
caching is handled with HTTP/CDN headers on anonymous responses.

For public pages:

1. Keep HTML request-time rendered instead of relying on the Full Route Cache.
2. Fetch public data through an anonymous server client that does not read
   cookies.
3. Let middleware set cache headers based on whether `_session` is present.
4. Keep authenticated/personalized controls as client-side components or
   dynamic subtrees.

This prepares public pages for anonymous-only HTTP/CDN caching while preserving
the authenticated invariant. Do not enable public HTML `s-maxage` for these
pages until the deployed cache key behavior is verified.

## Middleware vs Proxy

This repository currently uses Next.js 14.2.x. In Next 14, the request
interception file convention is `middleware.ts`, so cache-header request
classification belongs in `apps/web/src/middleware.ts`.

Current Next.js versions have renamed this convention to `proxy.ts` and mark
`middleware` as deprecated. Do not rename the file in this repository until
Next is upgraded to a version that supports the `proxy.ts` convention and the
upgrade has been validated.

## Segment Config Rules

Be careful with layout-level route config:

- `dynamic = "force-dynamic"` in a layout affects that layout's children. The
  root app layout uses this intentionally so authenticated users do not receive
  Full Route Cache HTML. Do not add more broad layout-level dynamic flags unless
  the whole subtree needs that behavior for a separate reason.
- `revalidate` in layouts or pages affects the route. Do not add `revalidate`
  to auth-sensitive pages unless serving the same generated HTML to anonymous
  and authenticated users is acceptable.
- `fetchCache = "default-no-store"` should stay scoped to pages or route groups
  where cached data would break behavior.
- Prefer making HTTP cache behavior explicit through middleware and route
  handlers instead of adding segment config to silence build or prerender
  errors.

## Approved Initial Targets

The first shared-cache targets are:

- `/bottles/[bottleId]` and nested public bottle tabs.
- `/entities/[entityId]` and nested public entity tabs.
- Sitemap route handlers at `/sitemap.xml` and under `/sitemaps/*`.

Bottle and entity detail pages should use dynamic SSR and anonymous server data
fetching. Public HTML cache headers for those pages are intentionally blocked
until the deployed edge cache behavior is verified. All sitemap route handlers
should use explicit public XML cache headers because they do not have
authenticated variants.

## Verification

For every cache-sensitive route, verify both request classes:

```bash
curl -I https://peated.com/bottles/1
curl -I -H 'Cookie: _session=dummy' https://peated.com/bottles/1
```

Expected anonymous public route headers:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

Expected authenticated route headers:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

If `Vary: Cookie` is not present on the deployed response, confirm the hosting
layer still bypasses or revalidates shared cache entries for `_session` requests
before enabling public HTML cache headers broadly. On Vercel this must be
verified against the deployed app, because local `next start` does not model
the edge cache lookup order.

After deploy, watch Sentry for drops in server-side ORPC traffic from
`@peated/web (orpc/server-anonymous)` and `@peated/web (orpc/server)` on:

- `POST /rpc/bottles/details`
- `POST /rpc/entities/details`
- `POST /rpc/bottles/list`
