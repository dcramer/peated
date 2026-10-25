# C34: Count an exact stored-reference match as an automation anchor

**Decision: Accepted.**

## Problem

The plain Tomatin 12-year-old case matched Bottle 65001 in all six saved CI
runs, but passed only three. The candidate came from an exact accepted Bottle
Reference equal to the source title. The derived tier was `auto` only when the
model labeled `webEvidence` as `not_needed`; on the same input it often wrote
`not_used`, which gives no anchor. Only `supportive` is defined in the schema,
so the tier depended on an undefined label.

Production already skips the model for this shape: the exact-reference path in
`apps/server/src/agents/bottleClassifier/service.ts` matches the assigned
Bottle with `not_needed` before classification. Reference names are unique, so
an exact stored reference is a closed identifier, like an SMWS code.

## Change

- `matchesExactStoredReference` in `src/automationTier.ts` is true when a
  Match selects a candidate whose exact stored reference is the source name
  itself, compared without case or apostrophes.
- The `exact` source tag alone is not enough. Retrieval also tags exact
  matches for names built from extracted facts and for the agent's own
  `search_bottles` queries, and the candidate merge drops that provenance.
  Without the source-name check, a match found through a query the model
  chose could reach the automatic tier.
- Server automation (`assessBottleResolution`) and the eval tier helper both
  pass it as a deterministic anchor.
- Unresolved risks and field conflicts still force review.

Server tests cover the anchored match, an exact-tagged candidate whose
reference is not the source name, a match to a different candidate, and an
anchored match that conflicts with source facts. The seven server test
files that consume `assessBottleResolution` pass unchanged.

## Results

| Case             | CI before (6 runs) | After (3 runs) |
| ---------------- | -----------------: | -------------: |
| Plain Tomatin 12 |                3/6 |            3/3 |

This does not define the other `webEvidence` labels. Basil Hayden still
depends on that label and is left for a separate prompt-contract change.
