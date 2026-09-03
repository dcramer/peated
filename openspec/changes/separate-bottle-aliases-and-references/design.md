## Context

`bottle_alias` currently stores 27,024 active production rows. It combines at least five responsibilities: canonical name reservation, exact source resolution, unresolved or ignored evidence, embedding/search input, and alternate names. Assigned rows cover nearly the complete Bottle catalog, while a smaller set supplies noncanonical matching evidence. A production sample confirmed that noncanonical rows still support live prices and reviews, so removing the resolver is unsafe. The same audit also found generic strings assigned to specific releases, which makes the current global fast path unsafe when a row is wrong.

The active `flatten-bottlings-into-bottles` change and durable Bottle identity documentation call all exact reference strings aliases. This change supersedes that terminology while preserving the direct Bottle identity invariant: every accepted reference and every displayed alias still belongs to one Bottle, never a BottleGroup.

## Goals / Non-Goals

**Goals:**

- Give “alias” its customer-facing meaning: a verified alternate marketed Bottle name.
- Preserve the existing exact resolver and all production data as BottleReference.
- Make display authority and exact-resolution authority independent.
- Ship a complete Bottle-details “Also known as” slice with moderator ownership.

**Non-Goals:**

- Automatically classify, delete, retarget, or merge existing records.
- Add market, country, language, or date ranges to aliases.
- Treat a renamed SMWS subtitle as a new Bottle when its society code and exact release facts agree.
- Change BottleGroup identity or use a group as an alias or reference target.

## Decisions

### 1. Use separate storage and domain names

The existing `bottle_alias` data becomes `bottle_reference`. BottleReference retains the current nullable Bottle assignment, ignored/quarantine state, embedding, assignment source, actor, legacy migration value, and timestamps. It gains a stable primary key. Nullable historical review fields remain in the schema for migration compatibility but have no API workflow.

A new `bottle_alias` table stores `id`, `bottleId`, the display `name`, a private `normalizedName` comparison key, `createdByActorId`, and timestamps. It has normalized uniqueness per Bottle, not globally. The same alias text can therefore describe multiple Bottles without becoming an exact identity assertion, while the display value keeps its original punctuation and capitalization.

Keeping one table with a `kind` column was rejected. It would continue mixing unresolved evidence, global matching authority, search documents, canonical claims, and presentation records. Reusing BottleReference rows directly for display was rejected because display safety and exact-resolution safety are independent.

### 2. Preserve exact matching behind BottleReference

Current alias resolver, assignment, propagation, embedding, and SMWS rename reservation modules become BottleReference modules through a hard code cutover. Active assigned references retain their exact-match fast path. Unassigned or quarantined references do not resolve.

A marketed Bottle title does not grant exact matching authority by itself because several structured releases can share a title. Accepted source and moderator workflows assign references explicitly. An unchanged SMWS code can preserve a previous subtitle as a reference after a rename. BottleReference keeps global case-insensitive name uniqueness because each active exact string can authorize at most one Bottle target.

BottleAlias creation never calls reference assignment or consumer propagation. If the same text must also be a safe exact reference, the moderator makes that decision through the reference owner.

### 3. Use aliases for presentation and candidate search only

Bottle details load aliases separately and return a sorted string list. The web page renders that list as “Also known as.” Bottle list responses do not hydrate aliases.

Bottle search vectors include BottleAliases as high-value name evidence. Alias text can therefore help a user discover a Bottle, but it does not make ingestion bypass the classifier. BottleReferences retain their existing exact and embedding behavior during the MVP; ignored references stay out of exact lookup and both search indexes.

Automatically treating every displayed alias as exact was rejected. A legitimate marketed name can still be generic across annual, batched, or cask-specific Bottles.

### 4. Coordinate a lossless hard cutover

The generated migration renames the existing table and its schema objects, adds a stable reference id and review fields, and creates the new alias table. It does not reinterpret or copy existing rows into customer aliases. Server, workers, CLI, and web change terminology together. Public internal-reference listing is removed; new reference routes require authority.

Before deployment, a retained preflight reports counts and fingerprints by name, Bottle assignment, ignored state, assignment source, actor, and creation time. Alias/reference mutation workers pause during the schema cutover. A postflight repeats the report before workers resume. Any mismatch fails the rollout.

The previous application release cannot safely run against the renamed schema. Operational rollback therefore restores the prior application and schema together from the deployment backup. Destructive cleanup of compatibility fields or audit evidence is a separately approved change.

### 5. Preserve Bottle lifecycle behavior explicitly

Exact Bottle merge moves references using the existing collision rules. It also moves display aliases to the survivor and deduplicates equivalent aliases for that Bottle. Tombstone reads return the replacement Bottle's aliases. Ordinary delete follows current Bottle deletion authority and does not introduce alias-specific implicit retargeting.

## Risks / Trade-offs

- **Risk: Two records can contain the same text.** → Treat that as two explicit facts with different authority; UI and code use distinct domain nouns and operations.
- **Risk: The coordinated table rename narrows rollback options.** → Pause relevant workers, retain preflight/postflight fingerprints, and restore schema plus application together if rollback is required.
- **Risk: Public API consumers used the old internal alias list.** → Treat the route cutover as breaking, document the new BottleAlias response, and keep BottleReference routes private.

## Migration Plan

1. Add and test retained read-only preflight/postflight reporting against production-shaped fixtures.
2. Generate the schema migration that renames existing storage to BottleReference, adds stable ids and review fields, and creates the empty BottleAlias table.
3. Hard-cut server modules, jobs, routes, serializers, CLI commands, and moderator terminology from alias to reference for existing behavior.
4. Add BottleAlias ownership, merge behavior, search indexing, Bottle details serialization, and moderator mutations.
5. Add Bottle detail “Also known as” presentation.
6. Run preflight, pause reference mutation workers, deploy migration and application, run postflight, and resume workers.
7. Seed a bounded set of verified SMWS alternate subtitles.

## Open Questions

- None required for the MVP. Market and language qualifiers can be proposed after reviewed production aliases demonstrate a need.
