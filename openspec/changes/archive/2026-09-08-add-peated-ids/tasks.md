## 1. Documentation and Shared Contract

- [x] 1.1 Document Peated IDs, supported object types, formatting, URL behavior, search behavior, compatibility, and scope in the main architecture documentation.
- [x] 1.2 Add shared, deterministic Peated ID formatting and parsing helpers with focused tests.

## 2. API

- [x] 2.1 Add readonly `peatedId` fields to bottle and entity response schemas.
- [x] 2.2 Serialize bottle and entity Peated IDs with their type prefix and at least four numeric digits.
- [x] 2.3 Recognize exact, case-insensitive Peated IDs in global search while respecting included result types and tombstones.
- [x] 2.4 Add route coverage for serialized Peated IDs and exact Peated ID search.

## 3. Web URLs and Display

- [x] 3.1 Route uppercase bottle and entity Peated ID root URLs through the existing detail page layouts.
- [x] 3.2 Permanently redirect lowercase Peated ID URLs and exact legacy numeric detail URLs to uppercase Peated ID URLs without claiming nested routes.
- [x] 3.3 Add a reusable Peated ID display with a permanent link and accessible copy action.
- [x] 3.4 Show Peated IDs on bottle and entity headers and use Peated ID URLs for share actions.
- [x] 3.5 Publish Peated ID URLs in bottle and entity sitemaps.
- [x] 3.6 Add focused route and component coverage for URL normalization and Peated ID display behavior.

## 4. Verification

- [x] 4.1 Run targeted server tests for Peated ID helpers, bottle/entity details, and global search.
- [x] 4.2 Run targeted web tests for routing and Peated ID display behavior.
- [x] 4.3 Run formatting, lint, and server/web typechecks for the touched surface.
