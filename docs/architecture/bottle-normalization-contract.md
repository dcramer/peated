# Bottle Normalization Contract

This document defines what deterministic bottle-name normalization is allowed to
do before alias lookup, duplicate checks, search, or classifier input.

The short version: normalization may make the same reference string easier to
compare. It must not infer bottle or release identity that the source text did
not state.

Use this with:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Creation And Alias System](./bottle-creation-alias-system.md)
- [Bottle Normalization Examples](./bottle-normalization-examples.md)

## Goals

- Produce stable comparison keys for deterministic checks.
- Keep harmless formatting differences from creating duplicate aliases.
- Preserve identity-bearing tokens for classifier and moderator review.
- Make unsafe semantic interpretation visible in tests instead of hiding it in
  string cleanup.

## Non-Goals

- Do not decide bottle-vs-release scope.
- Do not infer age, vintage year, release year, batch, cask, brand, bottler, or
  distillery from surrounding metadata.
- Do not strip retailer-specific detail if doing so could change which bottle or
  release the text references.
- Do not replace classifier or moderator judgment for semantic normalization.

## Allowed Transformations

Allowed deterministic normalization is identity-preserving:

- collapse repeated whitespace
- normalize quote, dash, and separator punctuation when tokens stay present
- standardize explicit age wording, such as `10 years old` to `10-year-old`
- normalize obvious ABV spelling and spacing without changing the value
- trim generic container text only when it is known not to identify the product,
  such as surrounding whitespace or duplicated category words already excluded
  by tests
- preserve capitalization however the display layer needs, as long as matching
  remains case-insensitive

An allowed transformation should pass this test:

> A reviewer who only sees the normalized string would still know which source
> words were used to make the deterministic decision.

## Disallowed Transformations

Deterministic normalization must not:

- rewrite a bare number as an age statement
- decide that a bare year is vintage year or release year
- turn batch, cask, barrel, bottle number, store-pick, or exclusive wording into
  release identity
- remove batch, cask, barrel, store-pick, ABV, edition, vintage, or release-year
  text before classifier review
- change brand, bottler, or distillery boundaries by prefix matching
- treat an extracted metadata field as permission to rewrite the source name
- create or look up a deterministic alias from a lossy normalized string unless
  that exact normalized string has already been accepted as an alias

## Stories

### Explicit Age Wording

`Ardbeg 10 years old` may normalize to `Ardbeg 10-year-old`.

The text already states an age. Normalization only standardizes the spelling.

### Bare Number

`The Last Drop 42` must not normalize to `The Last Drop 42-year-old` just
because an input field or existing row has `statedAge = 42`.

The source name did not state age wording. The classifier or a moderator may
decide the canonical expression, but deterministic normalization cannot.

### Batch Text

`Springbank 12 Cask Strength Batch 24` should preserve `Batch 24`.

The classifier or moderator may decide whether `Batch 24` belongs on a release.
Deterministic normalization must not strip or promote it.

### Year Text

`Lagavulin Distillers Edition 2011 Release` should preserve the year wording.

The identity model decides whether `2011` is a release year, vintage year, part
of the product name, or ambiguous. Normalization only keeps the text comparable.

### Retailer Detail

`Four Roses Single Barrel Barrel Strength OESK Store Pick` should preserve the
store-pick and barrel-strength wording.

Those details may be observation-only, release identity, or noise. They are not
safe to remove before review.

## Alias Keys

Alias lookup and alias writes must use the same accepted key for a workflow.
That key may be raw source text or an identity-preserving normalized form.

If normalization is lossy or semantic, it is not a safe deterministic alias key.
Use it for search or classifier evidence instead.

## Test Requirements

Deterministic normalization tests should cover:

- explicit age wording normalization
- bare numbers that are not age statements
- bare years that are not automatically vintage or release years
- batch and cask tokens that remain present
- store-pick and exclusive wording that remains present
- alias lookup/write consistency for whichever key a workflow accepts

Classifier and eval coverage should cover the harder semantic cases where the
right output depends on label evidence, sibling releases, or web verification.
