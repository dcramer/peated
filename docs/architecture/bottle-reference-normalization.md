# Bottle Reference Normalization

`normalizeBottleReferenceKey` builds the comparison key used for exact Bottle
Reference lookup and assignment. It cleans presentation differences without
deciding Bottle identity or BottleGroup membership.

Use it with the [Whisky Identity Model](./whisky-identity-model.md),
[Bottle Reference Resolution](./bottle-reference-resolution.md), and
[Bottle Classifier](./bottle-classifier.md).

## Safe Contract

The helper may only:

- replace curly single and double quotes with straight quotes;
- remove `®` and `™` marks;
- standardize explicit age wording, such as `ten years old` or `10 yrs` to
  `10-year-old`;
- trim leading and trailing whitespace; and
- collapse repeated whitespace and line breaks.

It preserves capitalization and all other words and numbers. It does not
interpret a bare number or year, normalize batch syntax, infer cask flags,
remove release text, change Entity boundaries, or choose a BottleGroup.

Reference lookup and writes in one workflow must use the same key. An exact
shortcut is safe only when that key matches one active, non-ignored reference
assigned to exactly one Bottle. A lossy search key, alias, or similar name is
not an exact reference.

Examples:

- `Ardbeg   10 years old` becomes `Ardbeg 10-year-old`.
- `The Last Drop 42` remains `The Last Drop 42`.
- `Lagavulin Distillers Edition 2011 Release` keeps `2011 Release`.
- `Springbank 12 Cask Strength Batch No. 24` keeps `Batch No. 24`.
- Store-pick, exclusive, cask, barrel, edition, ABV, and vintage wording stays
  present.

Tests must cover these preservation rules and lookup/write consistency. Whisky
meaning belongs in classifier evals or moderator review, not this helper.

## Bottle Input Cleanup

`normalizeBottleInput` cleans a display name and extracts some structured facts.
It is not a safe replacement for `normalizeBottleReferenceKey`. It can normalize
batch wording, extract age and labeled years, remove release-year text, infer
`singleCask` and `caskStrength`, and reorder trailing parenthetical text. Some
results also depend on the current year.

Current classifier, validation, ingestion, and maintenance code uses the
explicit `normalizeBottleInput` name for this wider behavior. Exact-reference
keys still use `normalizeBottleReferenceKey`.

The old helper name is fully removed. Legacy scraper adapters now call
`normalizeBottleInput`. This helper is still not safe for exact-reference keys;
use `normalizeBottleReferenceKey` for those keys.
