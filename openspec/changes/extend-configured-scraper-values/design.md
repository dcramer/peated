## Context

Configured scraper rules version 1 reads the first value matched by each CSS
selector. That is enough for simple pages, but local previews found three
repeatable gaps:

- The Whisky Study needs to remove `Review` or `Shelf Review` from article
  titles and find a score element by its text rather than its position.
- Whisky Saga needs to join only paragraphs beginning with tasting-section
  labels so clips and tags keep the same evidence as the code adapter.
- Small price sources commonly publish a fixed 700 ml size or omit a producer
  prefix from each product heading.
- Compass Box marks sold-out products inside each card, so a safe selector
  cannot exclude their links without the unsupported relational `:has` syntax.

The revision table already stores `rulesVersion`, so new behavior can be added
without changing saved version 1 revisions. Preview and collection already use
the same parser and network controls.

## Goals / Non-Goals

**Goals:**

- Express the observed value cleanup with bounded data, not source code.
- Keep version 1 revisions byte-for-byte and behaviorally compatible.
- Make local preview, production preview, AI setup, manual editing, and
  collection interpret version 2 identically.
- Preserve source evidence used for names, scores, clips, tags, volumes, and
  matching.

**Non-Goals:**

- Arbitrary regular expressions, JavaScript, templates, or per-source plugins.
- Cross-origin requests, authentication, browser rendering, JSON APIs, or
  changing request policy.
- General product filtering beyond a bounded list-item text exclusion.
- Migrating a source whose complete local and production previews do not match
  its stored coverage and identity.

## Decisions

### Add rules version 2 and retain a separate version 1 interpreter

New revisions use version 2. Loading a revision dispatches to the schema and
value reader for its stored version. Version 1 parsing remains frozen instead
of silently acquiring new defaults.

This is preferred to extending the version 1 object in place because a future
parser change must not alter replay or rollback behavior for an immutable
revision.

### Use one bounded value expression instead of field-specific transforms

A version 2 value expression has exactly one input:

- `selector` plus optional `attribute`; or
- fixed `value` text.

Selector input can optionally filter normalized element text with a bounded
`startsWith` list and set `all: true` to join every remaining match in document
order with one space. The resulting text can remove the first matching literal
from bounded `removePrefixes` and `removeSuffixes` lists and then add bounded
`prefix` and `suffix` literals.

Operations run in that order: read, normalize, filter, choose or join, remove a
prefix, remove a suffix, add a prefix, add a suffix. Comparisons for
`startsWith`, `removePrefixes`, and `removeSuffixes` are case-insensitive;
output keeps the source's original spelling. Empty results remain missing
values and use the existing field validation.

One expression shape keeps review and price rules understandable in the JSON
editor. Literal operations cover the observed sources without admitting code
or regular-expression denial-of-service risks. Fixed values are source claims,
so preview must display them alongside scraped fields for human verification.

### Bound every new operation

Fixed values and added prefixes or suffixes are limited to 200 characters.
Removed prefix and suffix lists contain at most 10 non-empty values of at most
100 characters. `all` can
join at most 100 selected elements, and the existing 50,000-character review
text limit is applied after joining.

AI setup receives the same schema and plain-language operation order. It must
prefer source text and use fixed values only when the source makes that fact
stable and unambiguous, such as a shop that sells only 700 ml bottles in the
selected list.

### Scope optional exclusion to one list item

Version 2 list rules can set an `item` CSS selector. When present, the detail
link selector is evaluated independently inside each item. An optional
`excludeWhen` selector can skip that item when it finds non-empty text,
optionally limited to text beginning with one of the same bounded literal
prefixes used by value rules.

This makes a card-local fact such as `Sold out` usable without admitting
relational CSS, regular expressions, or cross-item state. `excludeWhen` is
invalid without `item`; version 1 retains its original global link selection.

### Put the rules version in local preview input

The local preview file accepts `rulesVersion` and requires it for version 2
rules. Omitting it continues to mean version 1 for existing files. The command
passes the version through the same runtime parser used by stored revisions.

## Risks / Trade-offs

- [A fixed value becomes false when a shop changes its catalog] → Preview shows
  the fixed output; source migration notes must record the public evidence, and
  normal health checks still surface invalid or changed pages.
- [Text-prefix filtering misses a new label spelling] → A missing required
  value fails preview or collection; optional review text remains visible in
  preview comparison before activation.
- [Joining matches captures navigation or repeated mobile markup] → CSS scope,
  a 100-element limit, document-order joining, and local no-write preview bound
  and expose the result.
- [Two rule versions increase parser complexity] → Keep separate schemas and
  value readers with shared final validators and fixtures proving version 1
  output does not change.
- [AI overuses cleanup operations] → Code validates only bounded literals, AI
  review sees final parsed values, and activation still requires a fresh
  production preview.

## Migration Plan

1. Deploy version 2 schema, interpreter, editor, suggestion, and local preview
   support while leaving all active revisions on version 1.
2. Re-run local no-write previews for Whisky Study, Whisky Saga, and one small
   price source with version 2 rules.
3. Compare full output with stored URLs, names, scores or prices, Bottle
   matches, and item counts before preparing or activating any source.
4. Create new inactive version 2 revisions and use normal production preview
   and activation controls.
5. Roll back by activating the previous passing revision or pausing the source;
   version 1 interpretation remains available.

## Open Questions

None. The operations are limited to cases demonstrated by current public
sources; further transforms require another rules version.
