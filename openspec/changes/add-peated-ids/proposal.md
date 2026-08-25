## Why

Bottle and entity links currently expose untyped database numbers inside resource-specific paths. Peated needs a short, memorable way for people and integrations to identify a catalog object, share it, and find it again without relying on its name.

## What Changes

- Introduce permanent Peated IDs for externally referenced bottles and entities.
- Format bottle IDs as `B` plus at least six digits and entity IDs as `E` plus at least six digits, using each record's existing numeric ID.
- Serve permanent short URLs such as `https://peated.com/B000123` and `https://peated.com/E000123`.
- Show the Peated ID on bottle and entity pages with a copyable link.
- Expose Peated IDs in API responses and recognize exact Peated IDs in global search.
- Preserve existing bottle and entity detail URLs as compatibility redirects.

## Capabilities

### New Capabilities

- `peated-ids`: Stable, typed public references, short URLs, display, and lookup for bottles and entities.

### Modified Capabilities

None.

## Impact

- Shared server code: add Peated ID formatting and parsing helpers.
- API: add `peatedId` to bottle and entity response schemas and serializers; support exact Peated ID lookup in global search.
- Web routing: resolve root-level Peated ID URLs while retaining the existing route layouts and redirect old detail URLs.
- Web UI: display a copyable Peated ID on bottle and entity headers and use Peated ID URLs for sharing and sitemaps.
- Documentation and tests: define the public contract and add focused helper, API, route, and component coverage.
