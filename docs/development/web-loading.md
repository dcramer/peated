# Web Loading

Use Next.js loading boundaries for route data and React transitions for feedback
while navigating. Keep the page header, filters, and navigation available while
the results change. The URL owns committed filters and pagination.

This guide is the source of truth for loading views and skeletons in the web
app. A loading view is what appears while data is pending. A skeleton is the
part of that view that reserves the shape and space of the expected content.

## Choose the Loading Pattern

| Situation                                                         | Use                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Most of one route waits, but its parent layout should remain      | A route-specific `loading.tsx` that reuses the page's named loading component         |
| One section can load without blocking the rest of the page        | `Suspense` around that section, with its stable heading and controls outside          |
| Useful results are already visible during a sort or filter change | Keep those results and show pending feedback instead of replacing them with skeletons |
| The waiting code never renders visible content                    | `fallback={null}` with a local lint exception that explains why                       |

## Route Loading

Place `loading.tsx` below the layout that should remain visible. A segment's
loading file covers its page and nested segments, not its own layout. Keep
fallbacks free of data fetching and reuse the existing loading components.
Do not add a catch-all loading file to a route group that contains unrelated
page layouts. Static pages and redirect-only routes do not need skeletons.

For independently loading server content, put the asynchronous read inside a
component beneath `Suspense`. Awaiting the read before returning the boundary
prevents that boundary from streaming its fallback.

Keep fixed headings, navigation, controls, and actions outside `Suspense`. Wrap
only the part that must wait. If separate parts can load on their own, give each
part its own `Suspense` block.

## Loading Component Ownership

Every `Suspense` block that replaces visible content uses one named component
whose name ends in `Loading`, such as `BottleListLoading`. Put it in the same
file as the component whose layout it copies whenever practical. The component
owns its loading layout; route `loading.tsx` files and other boundaries import
and reuse it instead of drawing their own placeholders.

The `Loading` name does not mean we should maintain a second copy of the
component. Our target is to derive the loading view from the finished component.
Both share the same internal layout, while the loading component supplies
representative rows and replaces changing text and media with placeholders.
Keep wrappers, grids, spacing, and responsive rules in that shared layout. Write
separate skeleton markup only when sharing it would make a small component
harder to understand.

Shimmer From Structure demonstrates this goal by measuring finished markup in
the browser. Peated's route fallbacks must also render in the first server HTML,
so we share the React structure directly instead of waiting for browser
measurement.

The
[require-suspense-loading lint rule](../../tools/oxlint/anti-slop/rules/require-suspense-loading.ts)
requires every React `Suspense` block to have an explicit fallback made from one
named component ending in `Loading`. A block that never renders anything may
use `null` only with a local lint exception that explains why. Lint checks the
fallback's name and shape. It cannot tell whether the loading component is
beside its owner or whether both layouts line up; code review and browser review
enforce those parts.

## Match the Finished Layout

Copy the usual finished structure, spacing, row count, image size, and text
height closely enough that loading content can be replaced without moving the
page. Keep real headings and controls visible when they do not depend on the
pending data. Do not replace a whole page when only one section has to wait.
Give shared or page-sized loading components a Storybook state beside the
finished state so they can be compared directly. Review route behavior in the
app, not only in Storybook.

Use representative data for the usual result. Match its normal list length and
text wrapping. Give images, charts, and other late-loading media an explicit
size or aspect ratio. Change content at the leaves of the shared structure;
do not rebuild the surrounding layout from placeholder-only containers.

For optional sections, copy the result people normally see. Show the section in
the loading view when its data is normally present, and omit it when absence is
normal. Do not weaken the usual loading layout to account for an exceptional
empty response. When possible, add optional content after stable content so its
appearance does not move what is already on screen.

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

Review every changed route in a browser:

- Delay its data response so the loading view remains visible.
- Compare the loading and finished layouts at desktop and phone widths.
- Check the usual result first, then empty and error states that the route
  supports.
- Measure layout movement when the loading view changes content already visible
  on screen.
- Check both color schemes and reduced motion when the changed feedback uses
  color or animation.

For navigation changes, also verify immediate feedback, the selected control
value, retained content, focus, the final URL, and the final results. Include
rapid changes and Back/Forward when changing URL state. Do not add appearance
assertions to deterministic tests; browser review owns appearance.

## References

- [Shimmer From Structure](https://shimmer-from-structure-docs.vercel.app/docs/how-this-works)
- [Next.js loading files](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js search and pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination)
- [Next.js link status](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [React transitions](https://react.dev/reference/react/useTransition)
- [TanStack pagination](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
