## Context

Bottle Series already have stable database IDs, Brand ownership, names, descriptions, search vectors, and release counts. Bottle responses embed the assigned Series, and the Bottle list route accepts a Series filter. The web app currently has no public Series route, the Series details response does not expose its owning Brand, global search cannot return a Series, and Series deletion hard-deletes the record after removing its Bottle assignments.

The new surface crosses catalog identity, search, moderation lifecycle, API serialization, canonical web routing, and responsive page composition. It must preserve the distinction between a Series and a BottleGroup: a Series is a named Brand range containing independently complete Bottles, while a BottleGroup only relates variants of one marketed Bottle.

## Goals / Non-Goals

**Goals:**

- Give every active Bottle Series a permanent public identity and canonical page.
- Present verified Series-owned context and the complete paginated Bottle membership.
- Make Series discoverable from Bottle pages, canonical IDs, and global search.
- Preserve old public references when duplicate Series merge.
- Reuse the existing page layout, Bottle list, Bottle rail, ratings, pager, error, and empty-state components.
- Keep public Series facts and signed-in Library progress visible before the Bottle list on every screen size.

**Non-Goals:**

- A standalone Series directory or browse index.
- Series-owned images, ratings, tasting aggregates, or manually curated Bottle positions.
- New Bottle or BottleGroup identity rules.
- A complete moderator UI for editing and merging Series.

## Decisions

### Series are public catalog objects

Add `series: "S"` to Peated ID formatting and parsing. Series `421` becomes `S0421`. The canonical web route is `/series/{numeric ID}-{slug}`, where the slug comes from `fullName` so Brand context remains present and name collisions do not matter. Numeric-only, stale-slug, merged-ID, and root Peated ID routes redirect permanently to the active canonical route.

This follows the existing Bottle route model. Keeping `/bottles?series=421` as the public destination was rejected because it exposes an internal filter, cannot own Series metadata, and gives Series no stable external identity.

### Summary and details contracts stay separate

The lightweight Series object embedded in Bottle responses gains only `peatedId`. A new details schema adds the owning Brand reference. This avoids making every Bottle serialization load Brand data that the Bottle already contains.

The dedicated page loads Series details and uses the existing `bottles.list` Series filter for membership. No parallel Series-Bottles endpoint is added.

### Series merge owns public-reference preservation

Add a Bottle Series tombstone table with source and destination IDs. A moderator merge operation moves Bottle and BottleGroup assignments through the existing Bottle update boundary, redirects older tombstones that target the source, records the change, and deletes the source. Series details follow a tombstone to the active destination.

The existing delete operation becomes valid only for an empty Series. A populated Series returns a conflict and must be merged instead. Empty deletion leaves a tombstone without a destination, matching current Bottle deletion behavior while preventing an active object from silently losing public membership.

### Search treats Series as a distinct result type

Add a `series` search scope, result group, nearest result, exact Peated ID result, and facet count. “Everything” includes Series. The web search renders Series with its Brand and Bottle count and links to the canonical Series page. This prevents a named range from appearing only as many near-identical Bottle results.

### The Series page is a focused server-rendered catalog page

The page uses the shared page header, Bottle list, sort control, cursor pager, error, and empty-state components. It shows a Brand link, Series name, optional description, Peated ID, and total Bottle count. Membership defaults to newest release and supports the existing relevant Bottle sort choices. Category and age filters are omitted because this page is already a scoped collection.

Series identity and counts sit above the Bottle list instead of in a side rail. Signed-in members also see the number of Series Bottles in their Library and can filter the list to Bottles in or outside their Library. These counts use the complete filtered result, not the current page. Signed-out visitors see only public facts.

The shared Bottle list omits its ratings block when a Bottle has neither tasting ratings nor a published review score. Long page titles use a smaller narrow-screen size and may wrap long words so they do not leave the viewport.

### Bottle pages use a shared Bottle rail section

Extract the current recommendation rail markup into a small reusable Bottle rail section inside the Bottle overview component. The Series widget uses the same Bottle visual, metadata, and rating presentation. It requests up to four Series Bottles, removes the current Bottle, shows at most three other Bottles, and links “See all N bottles” to the canonical Series page. It renders only when the Series contains another Bottle and does not show an empty shell.

The existing Series fact remains and links to the same canonical page.

## Risks / Trade-offs

- **Series search adds another global-search scope and query.** → Run it only when requested, retain the existing per-scope limit, and use the current indexed Series search vector.
- **Merging a large Series can update many Bottle groups.** → Reuse the transactional Bottle update boundary and finalize affected search/stat work after commit, as current Series deletion does.
- **Some Series have incomplete descriptions or release dates.** → Omit missing description text and use existing Bottle list fallbacks; do not infer Series prose or sequence.
- **Peated may not contain every official Series release.** → Say "In your library" and show a count against the currently cataloged Bottles. Do not call the Series complete or show a completion percentage.
- **Adding `S` changes Peated ID parsing exhaustiveness.** → Update exact-ID search and route tests at the same cutover.
- **A Series can become empty after all Bottles are reassigned.** → The page remains valid while the Series exists; moderators may delete it explicitly, producing a destination-less tombstone and a not-found response.

## Migration Plan

1. Add the Series tombstone schema and generate the migration with `pnpm db:generate`.
2. Deploy API identity, details, search, merge, and guarded-delete behavior.
3. Deploy canonical Series routing, search rendering, Series page, and Bottle widget links.
4. No data backfill is required because `S` IDs derive from existing numeric IDs and all current Series remain active.

Rollback can remove the web links and search scope while leaving the tombstone table in place. Merged Series must not be recreated under their old IDs.

## Open Questions

None. Explicit Series ordering, images, and aggregate scoring remain future decisions supported by evidence from real Series pages.
