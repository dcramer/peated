## Context

The Douglas Laing feed already exposes the exact ABV and provider taxonomy for
The Gauldrons Eclipse. The scraper uses ABV only as an eligibility filter, then
discards it; price matching therefore invokes image extraction, which misread
52.9% as 56.1% and invented a 2024 release year. The classifier then spent its
shared three-unit web allowance on three discovery queries and had no allowance
left to inspect the official page.

This change crosses the scraper, store-price persistence, price-matching, and
classifier-tool boundaries. It must remain distinct from the active
`add-source-scoped-store-price-identity` change: stable source keys identify a
store product, while `sourceBottleIdentity` contains normalized facts about the
Bottle shown by that product.

## Goals / Non-Goals

**Goals:**

- Reuse normalized provider-owned facts before paying to infer them again.
- Bound default Firecrawl usage while preserving exact-page verification.
- Keep provider payloads, timestamps, hosting, and taxonomy from becoming
  unsupported Bottle claims.
- Preserve current classifier and proposal contracts by using the existing
  optional `extractedIdentity` input.

**Non-Goals:**

- Do not create stable source product/SKU identity or source-scoped reuse.
- Do not make source facts authoritative over contradictory exact-product
  evidence.
- Do not add a provider-specific classifier tool or domain allowlist.
- Do not add retries, proxy fallbacks, or configurable page-read counts.
- Do not attribute every provider fee in this slice; model usage and tool-call
  measurement remain the existing observability contract.

## Decisions

### Persist only the normalized classifier schema

`StorePriceInputSchema` accepts optional `sourceBottleIdentity` using
`BottleExtractedDetailsSchema`, and `store_price` stores the parsed value as
nullable JSONB. This preserves a narrow provider-neutral boundary and rejects
raw Shopify objects. A dedicated relational schema was rejected because these
facts are optional classifier evidence, not queryable catalog authority.

Price matching passes the value through `extractedIdentity`. Supplying that
input already skips image extraction, so no new classifier branch or prompt
field is required. Fresh provider facts take precedence over a stale extraction
when a retry asks to reuse an older proposal.

### Map only facts owned by the Douglas Laing feed

The scraper maps vendor to consumer Brand only when the title has the same Brand
prefix. It also maps supported product type to Peated category, numeric `Abv:`
to ABV, normalized explicit age/cask wording, and explicit `Cask: Finished ...`
wording to the expression. It leaves bottler and release year null: the host
domain does not prove the bottler role, and Shopify publication time is not a
Bottle release claim.

### Separate discovery from verification allowances

The runtime budget tracks search queries and page reads independently. A run
allows at most two search queries and one page read by default, so discovery
cannot consume verification. The page reader may inspect `reference.url`
directly or a discovered result and requests Firecrawl's basic proxy for a
predictable single-page operation. One shared generic unit pool was rejected
because its accounting does not preserve workflow priority.

### Keep the page-read allowance fixed

Only search count remains environment-configurable. One exact page is the
smallest useful verification allowance, and another setting would add an
operational knob without a proven need.

## Risks / Trade-offs

- [A provider field is wrong] → Keep structured identity as fallible evidence
  and retain classifier review/web corroboration policy.
- [Basic proxy cannot read a JavaScript-heavy page] → Return the provider
  failure at the tool boundary; do not silently spend more credits on fallback.
- [A scraper emits partial facts] → The normalized schema fills missing fields
  with null and the classifier investigates only decisive gaps.
- [Naming collides with source product identity] → Use
  `sourceBottleIdentity`; reserve source IDs/SKUs for the separate source-scoped
  identity change.

## Migration Plan

1. Deploy the additive nullable `source_bottle_identity` JSONB column.
2. Deploy ingestion, scraper, and classifier budget changes together.
3. New Douglas Laing scrapes populate the field; existing rows remain valid and
   continue through image extraction until refreshed.

Rollback may stop writing/reading the optional field while leaving the nullable
column in place. Restoring the prior search default does not require data
migration.

## Open Questions

None.
