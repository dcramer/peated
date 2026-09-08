## Context

Public Bottle and Entity search uses PostgreSQL full-text vectors with plain-text AND queries. This is safe and indexed, but it does not match incomplete words even though the web UI searches while the user types. Global search also converts source failures into empty results and concatenates source lists before applying one shared limit. Bottle vectors are refreshed asynchronously, so a new Bottle has no partial-search coverage until its worker runs.

## Goals / Non-Goals

**Goals:**

- Make incomplete final words useful in typeahead search while preserving plain-text input semantics.
- Keep complete-word matches ahead of prefix-only matches.
- Make global failures visible and blend result types deterministically.
- Give new Bottles immediate canonical search coverage and keep related Entity names fresh.
- Preserve stable pagination and accepted-alias rules across catalog surfaces.

**Non-Goals:**

- Add semantic search, an external search service, or model-ranked results.
- Add typo tolerance or relaxed OR matching in this slice.
- Redesign public filters, user discovery, or classifier candidate retrieval.
- Add search analytics before the result contract is correct.

## Decisions

### Construct prefix queries from PostgreSQL lexemes

The server will derive lexemes with the same English and `unaccent` normalization used by stored vectors, quote each derived lexeme, and append the prefix marker itself. User text never becomes `to_tsquery` syntax. Routes will match either the existing complete-word query or this prefix query and will discount prefix-only rank.

This keeps the existing GIN indexes useful. A trigram index would add typo tolerance, but it is unnecessary for the first proven typeahead failure.

### Blend source lists after exact-match extraction

Global search will retain per-source ranked order, extract exact display-name matches, then round-robin the remaining source lists. Unauthenticated user search remains an unavailable source rather than an error. Operational errors from requested, available sources will propagate.

This avoids inventing a cross-domain numeric score while preventing one source from consuming every result.

### Persist a canonical initial Bottle vector

Bottle creation will build a vector from the complete Bottle and canonical Brand data already available in the transaction. The existing worker remains responsible for enriching it with accepted aliases, Series, bottler, and distiller data.

Entity name changes will enqueue Bottle vector refreshes for Brand, bottler, and distiller relationships. Other Entity edits will not fan out Bottle indexing.

### Keep fixes inside existing routes and jobs

Ranked routes will add an id tie-breaker. Library alias lookup will exclude ignored aliases. The client will discard stale responses and show an unavailable state on search failure, without offering Bottle creation from an incomplete search.

## Risks / Trade-offs

- **Prefix matches widen short queries** → Complete-word rank remains higher, and existing route limits still bound results.
- **Entity renames can enqueue many Bottle jobs** → Fan-out occurs only when a searchable Entity name changes and uses unique jobs.
- **No typo tolerance** → Keep this slice small; add trigram fallback only after a deterministic relevance corpus proves the need and threshold.
- **Round-robin is not one universal relevance score** → It is deterministic, preserves each source rank, and is easier to reason about than mixing unrelated scores.
