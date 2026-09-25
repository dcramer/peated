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
and producer discovery paths. TIN provides text retrieval. Existing
classification validation and automation gates still control assignment.

Catalog listing retains filters, counts, pagination, explicit sort choices, and
exact-reference priority. The Bottle section of global search shares these documents,
with exact names and references ordered before text relevance. Ordinary search does
not require embeddings.

## Documents and queries

Bottle `search_names` contains names, editions, cask codes, Series, and accepted
aliases. `search_terms` also contains producer relationships and release facts.
Both have TIN indexes; name queries receive an explicit boost. Entities and Series
hold only names, so each has one `search_names` document with a TIN index. Entity
documents contain the name, short name, references, and aliases. Series documents
contain the full name and the Brand names. The indexing jobs write these
documents, and creation writes initial documents.

Every text read uses TIN. The indexing jobs still write the older `search_vector`
GIN columns, which nothing reads; drop them in a separate migration.

User input is compiled into bounded literal TINQL. Catalog search supports
alphabetic prefixes. Candidate discovery uses a broad word query and, on an empty
text result, one spelling fallback with edit distance one. Numeric and mixed
letter/number identifiers never receive fuzzy or prefix expansion.

Broad word queries drop words that describe almost every whisky, such as
"single", "malt", "scotch", and "year", when any other word remains. An OR over
those words matches most of the catalog and scores every match for nothing. AND
and phrase queries keep every word.

Keep ranked text retrieval in the supported score-order-and-limit shape: filter on
`bottle` columns, order by `tin.score` alone, and limit. Break ties, join the
Brand, and page in memory or in an outer query over the winning ids. Compare
identity facts after bounded retrieval, rather than sorting the whole catalog in
application code. A page shorter than its limit already proves the total, so run
the count query only when more rows exist. See
[PlanetScale query shapes](https://planetscale.com/docs/postgres/search/reference/sql-shapes).

## Rebuilding documents

A record without search documents is invisible to TIN text search. Check coverage
with GET `/admin/catalog/coverage`; `withSearchDocuments` must equal `total` for
`bottles`, `entities`, and `series`.

To rebuild, use the authenticated API client to POST
`/admin/catalog/rebuild-search` with `{"scope":"bottles","afterId":0,"limit":100}`.
`scope` is `bottles`, `entities`, or `series`. Continue with each returned
`nextAfterId` until null. Each call queues at most 100 idempotent indexing jobs.
Failed calls can be repeated safely.

Queued index jobs live in Redis and do not survive a Redis reset. If coverage
stops short of `total` with no failed jobs, repeat the POST with
`"missingOnly":true`; it queues only records that still have no documents.

## Verification

Local Docker and CI use pinned PlanetScale Lead with planner hooks preloaded. Lead
checks compatibility, not hosted TIN performance. Local multi-column scoring also
does not establish identical hosted ranking. PlanetScale's published benchmarks
support the engine choice; endpoint measurements still detect application overhead.

API tests cover TIN retrieval, references before indexing, wrong relationships,
rare releases, prefixes, accents, typos, pagination, and indexing. Comparator tests
cover nearby casks, years, strengths, and unknown facts. Recorded-request tests
retain five moderation searches with their reviewed outcomes and public catalog
snapshots. They cover existing candidates, ambiguous results, and retrieval
before and after a missing Bottle is created, using the original query inputs.
These sampled cases protect retrieval behavior, not automatic-assignment precision.

See [Whisky Identity Model](whisky-identity-model.md).
