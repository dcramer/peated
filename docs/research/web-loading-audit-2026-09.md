# Web Loading Audit — September 2026

The reported profile Library sort delay also reproduced on the bottle catalog.
Both kept the old selection and results visible while Next.js requested the
new server render. The Library already had a route skeleton and a transition,
but its only navigation signal was `aria-busy`, which provided no visible
feedback. Query loading flags stayed idle during this server round trip.

This audit follows browse pages, search, sort controls, tabs, and pagination.
It does not change query ownership, caching policy, or mutation workflows.

## Findings and Changes

| Area                                                  | Finding                                                                                     | Change                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Profile Library                                       | Server-prefetched data meant client query state did not cover sort navigation.              | Optimistic control values and visible transition status; retained rows and existing initial skeleton.         |
| Bottle and producer catalogs                          | Sort and filter controls waited for committed URL state; empty lists removed their toolbar. | Same transition pattern, stable controls for empty results, and no filter-panel remount on query changes.     |
| Following, series, producer bottles, location bottles | The same direct `router.push` gap appeared in their source.                                 | Pending toolbar state and optimistic control values, with queries still using committed inputs.               |
| Tabs, paging, admin sort                              | Native links had no pending treatment; tabs and paging disabled prefetch.                   | Next link status in tabs, button links, and admin sort links; default prefetch for tabs and adjacent pages.   |
| Bottle releases and tastings                          | Server reads completed before returning results, without a local streaming boundary.        | Async results under a boundary keyed by bottle and cursor; section headings and bottle layout remain mounted. |
| Location, bottle, flight, event, admin sections       | Several routes fell back to a broader boundary above their persistent layout.               | Local loading files beneath the relevant layouts, using existing loading primitives.                          |
| Search submission                                     | Client search status did not cover the containing route's `router.replace`.                 | Include the route transition in the existing search status.                                                   |

## Verification

The owning browser workflows now hold navigation requests to check immediate
feedback, retained content, control values, and completion. Library coverage
also checks rapid filter/sort changes and browser history. Catalog coverage
checks empty results and clearing filters. A controlled upstream release-page
request distinguishes streamed skeletons from the earlier navigation delay.

The source audit identifies shared paths; it is not a claim that every route
and network failure was separately reproduced. Mutation redirects and Search's
existing client/server data ownership remain outside this loading cleanup.

See [Web Loading](../development/web-loading.md) for the reusable patterns and
framework references.
