# Web Loading

Use Next.js loading boundaries for route data and React transitions for feedback
while navigating. Keep the page header, filters, and navigation available while
the results change. The URL owns committed filters and pagination.

## Route Loading

Place `loading.tsx` below the layout that should remain visible. A segment's
loading file covers its page and nested segments, not its own layout. Keep
fallbacks free of data fetching and reuse the existing loading components.

For independently loading server content, put the asynchronous read inside a
component beneath `Suspense`. Awaiting the read before returning the boundary
prevents that boundary from streaming its fallback.

When a new query should replace the results with skeletons, key the results
boundary using the normalized inputs that identify those results. Keep controls
outside that boundary. Do not key the whole page: that also resets controls,
focus, and unrelated local state.

Server-render public records even when their HTML is streamed. Moving a read
into a client effect solely to get a loading indicator loses that rendering.
See [Web Caching](../architecture/web-caching.md) for session and caching rules.

## Updating Existing Results

For sorting an already visible list, keep the rows and show pending feedback.
The route wraps `router.push` or `router.replace` in `useTransition` and passes
the pending flag to `ListToolbar`. Use `scroll: false` for in-place filter and
sort changes; pagination can retain Next.js's normal scroll behavior.

Use `useOptimistic` for the controls' requested values when waiting for the URL
would make them revert to their old selection. Build subsequent filter changes
from those requested values so rapid changes compose. Reset the cursor when the
sort or filters change. Keep query inputs and cached results tied to the
committed URL until navigation completes.

The profile library demonstrates this distinction: its controls anticipate the
new URL, while its hydrated TanStack query continues to display the current
entries. `ListToolbar` exposes a live updating status outside the busy results
region. Keep the same distinction for empty results and errors.

`useTransition` tracks transitions started through that hook. It is not a
global router status and does not track unrelated links or browser history.
Use Next.js's `useLinkStatus` inside a link for feedback on that link's pending
navigation. Preserve native link behavior, including modifier clicks.

`PageTabs`, internal `ButtonLink` targets, and admin sort links compose
`LinkPending` inside their Next link. Its progress bar preserves the control's
size and has a static reduced-motion state. It ends when Next commits the
navigation; a streamed results boundary can remain pending after that.

Prefer Next.js's default prefetch behavior for small navigation groups and
adjacent pages. Dense lists of record links can disable prefetching. Pending
feedback must also work when a destination has not been prefetched.

Bottle releases and tastings demonstrate server results beneath a keyed
`Suspense` boundary. Their section headings sit outside the boundary, and the
bottle layout keeps identity and tabs mounted. The results component owns its
asynchronous read. Sortable client catalogs demonstrate retained results with
`ListToolbar pending` instead.

## Client Queries

Use TanStack's query state for client fetching. `isPending` covers a query
without data; `isFetching` also covers refetching with data. A route transition
can be pending while the current client query is idle, so query state alone
does not cover server navigation.

Use `keepPreviousData` with `useQuery` only when the old results are useful
during a query-key change. `useSuspenseQuery` does not support that placeholder
option. Do not change query ownership or introduce a second fetch solely to
make a loading state appear.

## Verification

Extend the browser workflow that owns the interaction. Hold its navigation
response to verify immediate feedback, the selected control value, retained
content, and focus; release it and verify the final URL and results. Include
rapid changes and Back/Forward when changing URL-state handling.

Check streaming fallbacks with a delayed upstream response, rather than
buffering the whole Next.js response. Review skeleton geometry and pending
feedback in a browser, including empty results, narrow screens, both color
schemes, and reduced motion. Do not add appearance assertions.

## References

- [Next.js loading files](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js search and pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination)
- [Next.js link status](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [React transitions](https://react.dev/reference/react/useTransition)
- [TanStack pagination](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
