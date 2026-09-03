## Why

Peated uses BottleAlias for canonical name claims, exact source matching, unresolved review state, search indexing, and customer-facing alternate names. This overload makes unsafe generic references authoritative for exact Bottle identity and prevents the product from showing trustworthy “Also known as” names.

## What Changes

- Split verified, customer-facing Bottle aliases from internal Bottle references.
- Preserve every existing BottleAlias row as a BottleReference so the migration does not silently change matching or consumer identity.
- Add Bottle aliases only through explicit moderator verification. Existing references do not become public aliases automatically.
- Treat display and resolution as independent decisions: an alias does not become an exact reference, and a reference does not become a displayed alias, without separate approval.
- Return verified aliases from Bottle details, show them as “Also known as,” and include them as search evidence.
- **BREAKING**: rename the current internal BottleAlias domain, routes, jobs, and storage ownership to BottleReference. The BottleAlias API will represent only verified alternate marketed names.

## Capabilities

### New Capabilities

- `bottle-aliases`: Verified alternate marketed names, moderator management, Bottle detail presentation, and safe search participation.
- `bottle-references`: Internal exact-reference resolution, lossless migration, and moderator assignment.

### Modified Capabilities

None.

## Impact

- Database schema and generated migrations for the existing `bottle_alias` data and the new customer-facing alias records.
- Bottle creation, update, merge, source ingestion, price matching, external review matching, search indexing, vector indexing, and background jobs.
- Bottle alias and reference oRPC/OpenAPI contracts, moderator tools, and Bottle detail serialization.
- Bottle detail and moderator operations.
- Bottle identity, normalization, creation, matching, and active `flatten-bottlings-into-bottles` documentation that currently uses “alias” for exact references.
- Production rollout requires a retained preflight and postflight report. No reference operation may delete, retarget, or clear a consumer automatically.
