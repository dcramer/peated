## Context

Bottles and entities already use stable auto-incrementing numeric primary keys. Those numbers appear in API responses and resource-specific URLs such as `/bottles/123` and `/entities/123`. The type-specific paths prevent ambiguity, but the references are not compact or recognizable outside a URL.

Peated IDs provide a human-facing public reference without replacing the numeric keys used by the database and existing API inputs. The complete value is unique because its prefix identifies the object type. A bottle and entity may both have numeric ID `123` while their Peated IDs remain distinct as `B0123` and `E0123`.

## Goals / Non-Goals

**Goals:**

- Give every bottle and entity a permanent, compact Peated ID.
- Make `https://peated.com/B0123` and `https://peated.com/E0123` stable public URLs.
- Keep IDs easy to read, type, copy, paste, and search.
- Preserve current numeric database relationships and API compatibility.
- Keep old and merged-object links resolving to the current object.

**Non-Goals:**

- Add Peated IDs to bottle groups, flights, tastings, prices, aliases, observations, join rows, or other internal records.
- Replace numeric database primary keys or foreign keys.
- Change existing mutation inputs from numbers to Peated ID strings.
- Hide catalog growth or make public catalog identifiers unguessable.
- Add punctuation, checksums, random strings, or title slugs to Peated IDs.

## Decisions

### Derive Peated IDs from existing numeric IDs

The formatted value is `B` plus `bottle.id` or `E` plus `entity.id`. The numeric part uses leading zeroes until it contains four digits. Larger numbers keep their full length. No new sequence or database column is needed. The prefix makes the complete reference unique across supported object types, even when their numeric portions match.

Alternative considered: allocate numbers from a new shared sequence. This adds schema and creation-path complexity without improving the uniqueness or usability of the complete prefixed value.

### Use the product term “Peated ID”

Documentation will call the value a Peated ID. Page headers will use the compact label `ID`, and API responses will expose it as `peatedId`. Internal code may use parsing and formatting terminology, but the product will not introduce specialized identifier jargon.

### Reserve prefixed numeric IDs at the root URL

The web layer will recognize root paths matching the supported Peated ID forms and internally route them through the existing bottle and entity pages. This preserves their layouts and behavior while keeping the short URL visible. Input is case-insensitive and may omit leading zeroes. Non-canonical forms redirect to uppercase IDs with at least four digits.

Exact legacy detail paths `/bottles/<number>` and `/entities/<number>` redirect permanently to their Peated ID URLs. Collection and nested workflow routes retain their existing paths.

Alternative considered: make Peated ID URLs redirect to existing resource paths. That would make them useful as short links but would discard the compact URL after navigation.

### Keep numeric `id` and add `peatedId` to API output

Bottle and entity response schemas will retain numeric `id` and add readonly `peatedId`. Existing consumers continue to work, while new consumers can use the stable public reference. A future versioned API may choose Peated IDs as its primary external identifier, but this change does not require that migration.

### Recognize exact Peated IDs in global search

An exact, case-insensitive Peated ID query will directly load the corresponding bottle or entity when that result type is included. Normal text search remains unchanged. This makes copied IDs useful without teaching users a separate lookup workflow.

### Preserve merged-object resolution

Peated IDs use the same numeric value already handled by bottle and entity tombstones. Looking up an ID for a merged object will follow the existing tombstone behavior and resolve to the surviving object's Peated ID.

### Display the ID as quiet primary metadata

Bottle and entity headers will show `ID` and the formatted value near the title. The value links to its permanent URL and provides a copy action for the full URL. It should be easy to find without competing with the object's name.

## Risks / Trade-offs

- Sequential IDs reveal approximate catalog growth → Bottles and entities are public catalog objects whose numeric IDs are already exposed.
- A mistyped number may identify a different object → Keep copy actions prominent and use strict prefix-plus-positive-integer parsing.
- Root paths constrain future routing → Reserve only exact bottle and entity ID patterns; normal named routes remain unaffected.
- Existing links may cause an extra redirect → Permanently redirect exact legacy detail URLs and update prominent sharing and sitemap outputs immediately.
- Prefix meanings become durable public behavior → Limit the initial namespace to the two object types known to need external references.

## Migration Plan

1. Add and test shared Peated ID format and parse helpers.
2. Add `peatedId` to bottle and entity API outputs.
3. Add exact Peated ID search lookup.
4. Add root URL routing and legacy detail redirects.
5. Display and share Peated IDs from bottle and entity pages.
6. Publish Peated ID URLs in bottle and entity sitemaps.

Rollback is low risk because there is no database migration. The additive API fields may remain even if short URL promotion is temporarily removed.

## Open Questions

None.
