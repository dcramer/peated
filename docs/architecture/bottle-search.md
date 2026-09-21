# Bottle search

Search returns suggestions. Rank and matching fields do not authorize an assignment
or prove that two releases are identical.

## Retrieval

Creation candidates use independent windows of 50 text matches and 50 candidates
from known Brand or distillery IDs. An accepted exact reference can add its directly
assigned Bottle before indexing catches up. Ignored references and retired Bottles
are excluded. Candidate queries read identity fields; only final results receive
full Bottle serialization. Responses retain the existing Bottle fields and add
agreements, missing facts, and conflicts.

The shared comparator orders release evidence before name similarity. Stored
relationship IDs take precedence over names. Cask punctuation and small ABV
differences remain conflicts. Missing facts are not contradictions. Maturation
wording and outturn do not determine identity. Bottling year remains contextual
evidence, not an independent reason to create another Bottle.

The classifier uses the same comparison and retains its exact-reference, vector,
and producer discovery paths. TIN replaces text retrieval when enabled. Existing
classification validation and automation gates still control assignment.

Catalog listing retains filters, counts, pagination, explicit sort choices, and
exact-reference priority. The Bottle section of global search shares these documents,
with exact names and references ordered before text relevance. Ordinary search does
not require embeddings.

## Documents and queries

`search_names` contains names, editions, cask codes, Series, and accepted aliases.
`search_terms` also contains producer relationships and release facts. Both have
TIN indexes; name queries receive an explicit boost. The existing indexing job
writes these documents alongside the GIN vector. Creation writes initial documents.

User input is compiled into bounded literal TINQL. Catalog search supports
alphabetic prefixes. Candidate discovery uses a broad word query and, on an empty
text result, one spelling fallback with edit distance one. Numeric and mixed
letter/number identifiers never receive fuzzy or prefix expansion.

Keep text retrieval in the supported score-order-and-limit shape. Compare identity
facts after bounded retrieval, rather than sorting the whole catalog in application
code. See [PlanetScale query shapes](https://planetscale.com/docs/postgres/search/reference/sql-shapes).

## Rollout

1. Deploy the generated migration and document writers with `BOTTLE_SEARCH_TIN`
   unset. The migration requires hosted TIN or local Lead. GIN reads remain active.
2. Through the authenticated API client, POST `/admin/catalog/rebuild-bottle-search`
   with `{"afterId":0,"limit":100}`. Continue with each returned `nextAfterId` until
   null. Each call queues at most 100 idempotent indexing jobs. Failed calls can
   be repeated safely.
3. Wait for those jobs. GET `/admin/catalog/coverage` and require
   `bottles.withSearchDocuments === bottles.total`. Check representative aliases,
   release facts, and edited names through the API.
4. Set `BOTTLE_SEARCH_TIN=1`. Watch endpoint p95/p99, errors, query plans, and recall.
   Roll back reads by unsetting the flag; both document formats continue updating.

The implementation does not execute the production migration, backfill, or switch.

## Verification

Local Docker and CI use pinned PlanetScale Lead with planner hooks preloaded. Lead
checks compatibility, not hosted TIN performance. Local multi-column scoring also
does not establish identical hosted ranking. PlanetScale's published benchmarks
support the engine choice; endpoint measurements still detect application overhead.

API tests cover both read paths, references before indexing, wrong relationships,
rare releases, prefixes, accents, typos, pagination, and indexing. Comparator tests
cover nearby casks, years, strengths, and unknown facts. The benchmark retains 100
previously reviewed cases: 80 development and 20 held out. These measure retrieval
recall, not automatic-assignment precision.

See [benchmark instructions](../../apps/server/src/benchmarks/bottleSearch/README.md)
and [Whisky Identity Model](whisky-identity-model.md).
