## 1. URL Generation

- [x] 1.1 Add the web slugification dependency and implement non-empty
      Unicode-safe catalog slug generation with focused tests
- [x] 1.2 Generate canonical Bottle and Entity URLs from their current display
      names and update URL helper tests

## 2. Route Resolution

- [x] 2.1 Parse numeric and slugged public route segments by authoritative ID
      and reject malformed identifiers
- [x] 2.2 Canonicalize numeric, stale-slug, wrong-kind, Peated ID, and merged
      routes while preserving nested suffixes and query parameters

## 3. Public URL Consumers

- [x] 3.1 Update public Bottle and Entity links, page tabs, metadata, copied
      URLs, release-family links, and sitemaps to emit canonical slugged URLs
- [x] 3.2 Keep API and standalone mutation workflow routes numeric

## 4. Verification

- [x] 4.1 Run focused web tests for URL generation, routing, redirects,
      metadata, and sitemaps
- [x] 4.2 Run the web typecheck, lint changed files, and verify formatting
