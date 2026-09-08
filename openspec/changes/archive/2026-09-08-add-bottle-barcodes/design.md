## Context

Peated models each marketed release as an exact Bottle and intentionally keeps
package details such as volume outside Bottle identity. A Bottle can therefore
have several retail barcodes across sizes or markets, while one accepted barcode
must resolve deterministically for scanning. Raw or conflicting provider claims
will later belong in source observations rather than this canonical mapping.

## Goals / Non-Goals

**Goals:**

- Represent a one-to-many Bottle-to-barcode relationship.
- Normalize equivalent UPC/EAN representations to one globally unique GTIN.
- Reject malformed and checksum-invalid GTINs at the API boundary.
- Support public reads and moderator-audited writes.
- Preserve mappings when duplicate Bottles are merged.

**Non-Goals:**

- Importing or licensing third-party datasets.
- Recording source observations, confidence, package volume, or market metadata.
- Modeling serialized identifiers for an individual physical bottle.
- Automatically resolving conflicting source claims.
- Adding a barcode scanner UI.

## Decisions

### Store native display value plus canonical GTIN-14

The `bottle_barcode` table stores the submitted digit-only GTIN value and a
zero-padded GTIN-14 comparison key. This preserves the familiar UPC-A/EAN
representation while making equivalent values, such as a UPC-A and its
zero-prefixed EAN-13 form, collide deterministically.

Storing only raw strings was rejected because equivalent representations could
be assigned to different Bottles. Storing only GTIN-14 was rejected because it
would obscure the conventional printed representation.

### Enforce one canonical Bottle per normalized GTIN

A unique index on GTIN-14 provides deterministic lookup. Multiple rows may
belong to one Bottle. Conflicting provider assertions are not inserted into this
table; a future evidence layer can retain them without weakening canonical
lookup.

### Validate at the runtime boundary and constrain durable shape

A shared normalizer accepts unknown external text after whitespace and common
separator removal, supports GTIN-8, UPC-A/GTIN-12, EAN-13, and GTIN-14, and
verifies the GS1 check digit. Database constraints still require digit-only
values of supported lengths and a 14-digit canonical key.

### Expose a dedicated barcode resource

Public list and exact lookup routes keep Bottle serialization reusable and avoid
adding barcode queries to every Bottle list response. Moderator upsert and
delete routes use actor provenance. This resource boundary also fits later scan
and ingestion clients.

### Repoint mappings during Bottle merges

Exact Bottle merges transfer barcode rows to the selected destination before
deleting the source. Global GTIN uniqueness means this cannot create a
cross-Bottle barcode collision.

## Risks / Trade-offs

- **A valid GTIN can still be assigned to the wrong Bottle** → Restrict writes to
  moderators and retain actor/timestamp provenance.
- **Package metadata is unavailable in the initial model** → Keep the initial
  canonical key narrow; attach package/source facts through the planned evidence
  model rather than turning volume into Bottle identity.
- **Some source files omit leading zeroes** → Require sources to declare or
  repair that ambiguity before calling the canonical API.
- **Removing a mapping loses the active association** → Audit provenance remains
  available through the existing actor/change infrastructure only where used;
  richer source history is explicitly deferred.

## Migration Plan

1. Deploy the additive table and indexes.
2. Deploy API reads and moderator mutations.
3. Begin manual or source-backed population after the schema is live.

Rollback removes the unused additive table and routes. No existing rows require
backfill or transformation.

## Open Questions

- Which source-evidence schema should own package size, market, source URL, and
  conflicting barcode assertions?
- Should a later user scan create an unverified observation or require an
  immediate exact-Bottle selection?
