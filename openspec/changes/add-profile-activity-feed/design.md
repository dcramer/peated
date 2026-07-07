## Context

Profile Activity currently renders the first page of `tastings.list({ user })`, so activity is effectively tasting-only. Collection additions already write `collection_bottle` rows with `created_at` timestamps, but the existing collection bottle list route orders by bottle name for collection browsing and is not suitable as an activity source.

The new profile feed needs a union activity model: tastings remain primary entries, while collection additions become low-priority secondary entries. The feed should make Library/Favorites additions visible without turning bulk Library imports into a wall of low-value feed items.

## Goals / Non-Goals

**Goals:**

- Add a profile activity API that returns a discriminated union of profile activity entries.
- Keep tastings as primary activity entries with existing rendering and behavior.
- Add grouped collection-add entries as secondary activity.
- Apply secondary-entry grouping and throttling on the backend so clients receive a feed that is already composed for profile display.
- Preserve current profile privacy behavior.
- Link secondary entries to the destination collection when a stable web route exists and link preview items to bottle or release pages.

**Non-Goals:**

- Replace global, friends, or local activity feeds in this change.
- Add comments, toasts, notifications, or actions to collection-add entries.
- Add arbitrary custom collection management or custom collection detail pages.
- Add a durable generic `activity` table unless implementation proves read-time composition is insufficient.
- Backfill historical synthetic activity beyond existing `collection_bottle.created_at` rows available to query.

## Decisions

### Add a profile activity route instead of expanding `tastings.list`

Introduce a user-scoped profile activity route, for example `users.activity.list`, that resolves the target user, applies profile visibility rules, and returns activity entries. The response uses a discriminated union such as `type: "tasting"` and `type: "collection_add"` with a shared `createdAt` field.

Alternative considered: add collection-add rows into `tastings.list`. That would overload a tasting-specific API and force tasting consumers to handle non-tasting rows.

### Compose activity at read time for v1

Build profile activity from existing source tables:

- `tastings` for primary tasting activity.
- `collection_bottle` joined to `collection` for secondary collection-add activity.

This avoids a new durable activity table while the product rules are still settling. The route should fetch enough recent source rows to group secondary entries and still return the requested page size after throttling.

Alternative considered: write activity rows during collection bottle creation. That gives stronger batch semantics, but adds a new persistence model before we know whether profile-only activity needs it.

### Treat collection-add entries as secondary activity

Collection-add rows must be grouped before feed composition. Group by target user, collection, and a bounded time window. A default 24-hour window is a reasonable first pass for profile activity because bulk Library imports often happen as one session and are lower-priority than tastings.

After grouping, compose the feed so secondary entries are visible but capped. Initial policy:

- Return at most one secondary entry between primary tasting entries.
- Return no more than two secondary entries in the first page of ten entries when primary entries exist.
- If a profile has no primary entries, collection-add groups can fill the profile Activity tab instead of showing an empty state.
- Each collection-add entry previews a small fixed number of items, such as three or four, and includes `totalItems` for the hidden count.

Alternative considered: strict reverse-chronological merge of all groups. That is simpler, but a user importing many bottles could push tastings off the first page.

### Keep collection-add rendering compact

Collection-add entries should render as compact feed rows/cards rather than full tasting cards. A single item can show one bottle context row; multiple items should render a concise preview list with a `+N more` affordance. The card should visually share the profile feed style but avoid large imagery and action buttons.

Alternative considered: reuse `BottleCard` for every item in a grouped entry. That is useful for one item but too heavy for multi-item groups.

### Use current collection routes as link targets for reserved collections

For reserved profile collections, link `Library` to `/users/:username/library` and `Favorites` to `/users/:username/favorites`. Custom numeric collections can appear in the API response but should not get a collection link until the web app has a stable custom collection route.

Alternative considered: add custom collection detail routes in this change. That is a separate product surface and not required for profile activity visibility.

## Risks / Trade-offs

- Read-time grouping can be more complex than a stored activity table -> keep the route profile-scoped and add focused tests around grouping and pagination before broadening it.
- Offset pagination can split or duplicate grouped secondary entries -> use a timestamp-oriented cursor or over-fetch enough rows to make page boundaries stable.
- Secondary throttling may hide some collection activity -> include `totalItems` and destination links so the visible summary still represents the action.
- Collection-add timestamps come from individual row creation, not an explicit batch action -> group by bounded time window and collection to approximate user intent.
- Custom collection entries may lack a stable web link -> provide bottle/release links and reserved collection links for v1.

## Migration Plan

No schema migration is required for the initial read-time composition approach. Add backend schemas/routes, update the profile Activity tab to consume the new route, and leave global/friends/local activity on the existing tasting feed. Rollback can restore the profile tab to `tastings.list({ user })` without changing collection data.

## Open Questions

- Should the secondary grouping window start at 24 hours, or should it be shorter for Favorites than Library?
- Should custom collection-add activity be included before custom collection web routes exist, or should v1 limit secondary entries to reserved Favorites and Library?
