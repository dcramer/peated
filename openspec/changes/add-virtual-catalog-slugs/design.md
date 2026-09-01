## Context

Public Bottle pages use `/bottles/{id}`. Public Entity pages use the primary
kind collection and ID, such as `/distillers/{id}`. Shared URL helpers already
own most public links. Page loaders already redirect merged IDs and wrong
Entity collections. Bottle display names are already centralized in
`formatBottleDisplayName`.

The slug is part of the displayed URL. It can change when a Bottle or Entity
name changes. The numeric database ID remains stable and handles all lookups.

## Goals / Non-Goals

**Goals:**

- Generate readable Bottle and Entity URL segments without stored slug data.
- Accept numeric-only and old slug URLs, then redirect them to the current URL.
- Preserve merged-object redirects, Entity kind routes, nested page paths,
  query parameters, Peated ID routes, metadata, and sitemaps.
- Handle Unicode input without ever returning an empty slug.

**Non-Goals:**

- Find Bottles or Entities by slug alone.
- Add editable or historically stable slugs.
- Change API routes, database schemas, or mutation inputs.
- Add slugs to administrative and standalone mutation workflows.

## Decisions

### Generate slugs at the web URL boundary

`getBottleUrl` formats the current Bottle display name and then creates a slug.
`getEntityUrl` creates a slug from the Entity name. Both functions build public
URLs. No migration or backfill is needed.

The app does not store slugs because it does not use them for lookups. A stored
slug would also need an update after each name change.

### Prefer ASCII transliteration with a non-empty Unicode fallback

The URL helper uses `@sindresorhus/slugify` first. If the result is empty, it
keeps normalized Unicode letters and numbers. If the result is still empty, it
uses `bottle` or `entity`.

Always preserving Unicode was rejected because the desired common case is an
ASCII URL. Always requiring ASCII was rejected because names written only in
scripts that the library cannot transliterate would produce no slug.

### Use the ID for route lookups

The route parser accepts a positive safe integer followed by an optional slug.
It loads the object by the integer only. The page redirects when the requested
collection, ID, or slug is not current.

The redirect keeps nested paths such as `/tastings` and their query parameters.

### Keep workflow URLs numeric

Public links, page metadata, copied URLs, and sitemaps use slugs. API routes and
standalone edit, merge, audit, and creation workflows continue to use numeric
IDs.

## Risks / Trade-offs

- **A rename changes the current URL:** The ID keeps old links valid and the
  page redirects them to the new URL.
- **Some names do not have an ASCII form:** Keep normalized Unicode when the
  slug library returns an empty result.
- **Some callers have only an ID and kind:** Keep their workflow paths numeric.
- **Old numeric links add a redirect:** Update public links and sitemaps in the
  same change so normal navigation is direct.

## Migration Plan

Deploy the route parser, redirects, and new links together. Existing numeric
URLs remain valid, so no data migration is required. A rollback restores
numeric URLs without changing stored data.
