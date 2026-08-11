# Eval Expectation Review

This review covers the 97 active file-backed classifier fixtures on 2026-08-11:

- 69 Reference Classification fixtures;
- 19 Bottle normalization fixtures;
- 9 Bottle Audit fixtures.

## Contract coverage

The decision fixtures cover 41 matches, 20 Bottle creates, three no-match
results, and five ignored references. The normalization fixtures add Bottle
name coverage for real catalog cases. The audit fixtures cover two clean
results, six Bottle updates, and one Bottle merge.

The review checked these boundaries:

- common-label Bottle naming and complete flat Bottle drafts;
- product and exact-cask identity scope;
- source and web evidence for production misses;
- positive and negative alias-safety decisions;
- match targets and create-Bottle expectations.

Fixture validation now requires every classified decision fixture to name its
action and identity scope. A match expectation must name its Bottle id. A
create expectation must check Bottle fields or Bottle name text. The
normalization fixtures already require one or more expected Bottle names. The
audit fixtures already require typed Suggested Changes and inspected targets.

## Corrected expectation

The former `store-listing-avoids-matching-an-over-specific-local-edition-candidate`
fixture expected a new Bottle for `Glenmorangie Quinta Ruban 14-year-old`. That
expectation was wrong. Glenmorangie's official product page names The Quinta
Ruban 14 Years Old without an edition suffix. Peated Bottle 2466 stores the same
marketed Bottle with a `4th Edition` suffix. The reviewed outcome is a match to
Bottle 2466, not a duplicate create.

The fixture now uses the official product URL and current public Peated Bottle
record as verified sources. Its provenance records the exact DB outcome.

## Coverage tightened

- The Exclusive Malts Islay 2007 label prints Cask No. 1661 as the marketed
  single-cask release. Its existing-match fixture now asserts
  `identityScope = exact_cask`.
- The unsupported novelty-whiskey no-match fixture now asserts product scope.
- The clean Jameson Cold Brew current-assignment fixture now asserts the
  positive `global_alias` case. The noisy Ardbeg retailer-title fixture keeps
  the negative `none` case.

No prompt rule was added for one Bottle. Existing non-identical cases retain
the general boundaries: Cadboll Estate Batch 2 and Macallan 1994 prevent
over-specific sibling matches; SMWS and Willett cases cover exact-cask create
and match decisions; Shieldaig and Creag Isle cases cover common-label age
placement.
