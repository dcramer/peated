# Bottle Normalization Contract

This document defines what deterministic bottle-name normalization may do before
alias lookup, duplicate checks, search, or classifier input.

The short version: normalization may make the same reference string easier to
compare. It must not decide how source facts become canonical Bottle identity,
consumer identity, or BottleGroup membership.

Use this with:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Creation And Alias System](./bottle-creation-alias-system.md)
- [Bottle Classifier](./bottle-classifier.md)
- [Bottle Normalization Examples](./bottle-normalization-examples.md)

## Goals

- Produce stable comparison keys for deterministic checks.
- Keep harmless formatting differences from creating duplicate aliases.
- Preserve identity-bearing tokens for classifier and moderator review.
- Make unsafe semantic interpretation visible in tests instead of hiding it in
  string cleanup.

## Identity Boundary

Every marketed version is one independently complete Bottle. Its canonical
identity combines:

- a stable marketed expression, stored in the Bottle name; and
- structured exact-Bottle fields such as edition, release year, vintage year,
  effective stated age, ABV, single-cask/cask-strength flags, and cask traits.

Canonical creation materializes those values into the complete Bottle display
identity. Source facts that describe only the observed listing or physical unit,
such as a retailer selector, bottle number, or outturn, remain observations and
do not become canonical identity without reviewed evidence.

Independent creation starts in a singleton BottleGroup. Deterministic legacy
migration groups retained parents with their promoted release Bottles.
Normalization never chooses a group or strips text in order to manufacture a
group key. Automatic regrouping is a separate future capability.

## Non-Goals

- Do not decide whether a token belongs in the stable expression, a structured
  exact-Bottle field, or observation-only evidence.
- Do not infer age, vintage year, release year, edition, batch, cask, brand,
  bottler, or distillery from surrounding metadata.
- Do not strip retailer-specific detail if doing so could change which exact
  Bottle the text references.
- Do not assign or merge BottleGroups.
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
- decide that batch, cask, barrel, store-pick, exclusive, or edition wording is
  stable identity, structured exact identity, or observation-only evidence
- remove batch, cask, barrel, store-pick, ABV, edition, vintage, or release-year
  text before classifier review
- change brand, bottler, or distillery boundaries by prefix matching
- treat an extracted metadata field as permission to rewrite the source name
- derive or select BottleGroup membership from a normalized string
- create or look up a deterministic alias from a lossy normalized string unless
  that exact normalized string has already been accepted as an alias

## Stories

### Explicit Age Wording

`Ardbeg 10 years old` may normalize to `Ardbeg 10-year-old`.

The text already states an age. Normalization only standardizes the spelling.
The reviewed identity step decides how that age participates in the complete
Bottle.

### Bare Number

`The Last Drop 42` must not normalize to `The Last Drop 42-year-old` just
because an input field or existing row has `statedAge = 42`.

The source name did not state age wording. The classifier or a moderator may
decide the canonical expression and exact fields, but deterministic
normalization cannot.

### Batch Text

`Springbank 12 Cask Strength Batch 24` must preserve `Batch 24`.

The complete catalog entry is a Bottle. Reviewed identity may keep `Springbank
12 Cask Strength` as the stable expression and place
`Batch 24` in a structured exact-Bottle field, or may retain different placement
when product evidence requires it. Normalization only preserves the evidence.

### Year Text

`Lagavulin Distillers Edition 2011 Release` must preserve the year wording.

Reviewed identity decides whether `2011` is a release year, vintage year, stable
expression text, or ambiguous evidence. Normalization only keeps the text
comparable.

### Retailer Detail

`Four Roses Single Barrel Barrel Strength OESK Store Pick` must preserve the
store-pick and barrel-strength wording.

Reliable product evidence may establish some details as structured exact-Bottle
identity. Retailer-only selector wording or unit-specific facts may remain
observations. They are not safe to remove before review.

## Alias Keys

Alias lookup and alias writes must use the same accepted key for a workflow.
That key may be raw source text or an identity-preserving normalized form. Code
should build that form through `normalizeBottleAliasKey`.

If normalization is lossy or semantic, it is not a safe deterministic alias key.
Use it for search or classifier evidence instead. An exact accepted alias maps
directly to its authoritative Bottle. A general expression alias may map to the
retained general Bottle; no alias maps to BottleGroup or reconstructs a legacy
paired identity.

## Test Requirements

Deterministic normalization tests should cover:

- explicit age wording normalization
- bare numbers that are not age statements
- bare years that are not automatically vintage or release years
- batch and cask tokens that remain present
- store-pick and exclusive wording that remains present
- alias lookup/write consistency for whichever key a workflow accepts
- no deterministic BottleGroup selection from normalized identity

Classifier and eval coverage should cover semantic cases where stable-expression
placement, structured exact-Bottle fields, observation-only facts, entity roles,
or exact candidate matching depend on label, local-catalog, or web evidence.
