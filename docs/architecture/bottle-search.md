# Bottle search

Search returns suggestions. Rank and matching fields do not authorize an assignment
or prove that two releases are identical.

## Retrieval

Two searches ask "which existing Bottle is this?": the "Possible duplicates"
check on Bottle creation (`apps/server/src/orpc/routes/bottles/create-candidates.ts`)
and the classifier's Bottle candidates for photos, prices, auctions, and reviews
(`apps/server/src/lib/bottleReferenceCandidates.ts`). They share these rules:

- **Producer window.** Each reserves a window for Bottles of the known Brand,
  bottler, or distillery (`bottleProducerCandidates.ts`), so popular unrelated
  Bottles cannot fill the text limit and hide a rare release. Creation sends
  Entity IDs. The classifier has names from the source, and looks them up with
  the exact Entity name rule (name, short name, or accepted Entity reference)
  that classifier Entity search uses.
- **Comparison.** Typed release fields use the one comparison the classifier
  and automatic matching use (see "Deterministic Code" in
  [Bottle Classifier](./bottle-classifier.md)). Brand, bottler, Series, and
  distilleries compare by stored ID, or by name when an ID is missing. Missing
  facts are not contradictions.
- **Order.** `orderBottleCandidateComparisons` orders both lists:
  1. A Bottle from another distillery sorts last.
  2. A Bottle that shares the distillery, Brand, or bottler leads one that
     shares none. A Brand conflict alone only loses this step, because members
     and labels often name the bottler or owner as the Brand.
  3. Fewer release conflicts, then more release agreements.
  4. Text relevance.

Conflicting Bottles stay in the classifier's list, so a wrong fact on the
source or the stored Bottle cannot hide the real Bottle and cause a duplicate.
Creation, where a member chose the distilleries, leaves out a Bottle that shares
none of them; a Bottle with no stored distillery stays.

Each search keeps its other inputs:

- Creation: text matches on the entered name and an accepted exact reference.
- Classifier: text matches on the source text, embedding matches, an accepted
  exact reference, and Brand-name and Brand word-coverage matches. The limit
  keeps every Bottle found through the known Brand and expression words, even
  with a conflicting fact. Otherwise a wrong stored fact on the real Bottle
  ranks it below unrelated Brands, and the classifier creates a duplicate it
  never saw.

Ignored references and retired Bottles are excluded. Maturation wording and
outturn do not determine identity. Bottling year remains contextual evidence,
not an independent reason to create another Bottle. Candidate queries read
identity fields; only final results receive full Bottle serialization.
Responses retain the existing Bottle fields and add agreements, missing facts,
and conflicts. Existing classification validation and automation gates still
control assignment.

Catalog listing retains filters, counts, pagination, explicit sort choices, and
exact-reference priority. The Bottle section of global search shares these documents,
with exact names and references ordered before text relevance. Ordinary search does
not require embeddings. Every Bottle result, including a Peated ID match and a
possible match, carries its BottleGroup name and distilleries, so search rows
show the same name and producers as other bottle rows.

## Documents and queries

Bottle `search_names` contains names, editions, cask codes, Series, and accepted
aliases. `search_terms` also contains producer relationships and release facts.
Both have TIN indexes; name queries receive an explicit boost. Entities and Series
hold only names, so each has one `search_names` document with a TIN index. Entity
documents contain the name, short name, references, and aliases. Series documents
contain the full name and the Brand names. The indexing jobs write these
documents, and creation writes initial documents.

Every text read uses TIN.

User input is compiled into bounded literal TINQL. Catalog search matches
alphabetic prefixes of two or more letters, so "or" finds "Glen Ord". Typed
"and", "or", and "not" are ignored unless they are the whole query; they are
never search operators. Candidate discovery uses a broad word query and, on an
empty text result, one spelling fallback with edit distance one. Numeric and
mixed letter/number identifiers never receive fuzzy or prefix expansion.

Broad word queries drop words that describe almost every whisky, such as
"single", "malt", "scotch", and "year", when any other word remains. An OR over
those words matches most of the catalog and scores every match for nothing. AND
and phrase queries keep every word.

Keep ranked text retrieval in the supported score-order-and-limit shape: filter on
`bottle` columns, order by `tin.score` alone, and limit. Break ties, join the
Brand, and page in memory or in an outer query over the winning ids. Compare
identity facts after bounded retrieval, rather than sorting the whole catalog in
application code. A page shorter than its limit already proves the total, so run
the count query only when more rows exist. Filter active Bottles with
`activeBottleWhere`: its tombstone check is a `NOT IN` list, because a
`NOT EXISTS` subquery can plan as an anti-join, and `tin.score()` then fails
with "requires a tin index scan". See
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
cover nearby casks, years, strengths, unknown facts, and producer-before-release
order. Classifier model checks read a local catalog with its own simple search,
so they do not test this retrieval; the API tests above do. Recorded-request tests
retain five moderation searches with their reviewed outcomes and public catalog
snapshots. They cover existing candidates, ambiguous results, and retrieval
before and after a missing Bottle is created, using the original query inputs.
These sampled cases protect retrieval behavior, not automatic-assignment precision.

See [Whisky Identity Model](whisky-identity-model.md).
