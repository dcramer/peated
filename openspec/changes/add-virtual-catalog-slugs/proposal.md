## Why

Public Bottle and Entity URLs contain only numeric IDs. This makes shared links
hard to recognize. Peated can add readable names because the numeric ID still
identifies each object.

## What Changes

- Generate virtual Bottle and Entity slugs from their current display names.
- Use `{numeric ID}-{slug}` in public URLs.
- Use the numeric ID for lookups. Accept numeric-only, old slug, and merged URLs.
- Redirect old URLs to the current collection, ID, and slug
  while preserving nested paths and query parameters.
- Publish slugged URLs in internal links, metadata, copied URLs, and sitemaps.
- Keep API paths, mutation inputs, and database schemas unchanged.

## Capabilities

### New Capabilities

- `catalog-public-urls`: Defines readable name slugs and redirects for public
  Bottle and Entity pages.

### Modified Capabilities

None.

## Impact

The change affects public web URLs, redirects, Peated ID routes, page metadata,
and sitemaps. It uses the same slug library as other apps in the repository. It
does not change the database or API.
