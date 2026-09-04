# C11: bypass Luna for accepted Bottle References

**Accepted.** The server classifier entry point now resolves a literal accepted
Bottle Reference before it creates a Luna run. Candidate merging also keeps the
accepted reference text when another search method found the same Bottle first.

## Problem

Bottle References are globally assigned identity records. Existing ingestion
resolvers and photo identification already skipped Luna for exact references, but
the shared server classifier entry point did not. Store-price classification
uses that entry point directly. It could therefore spend a Luna request and let
the model reconsider a Bottle identity that Peated had already accepted.

Candidate search had a second, narrower problem. Vector or text search results
were merged before the exact result. When both represented the same Bottle, the
merge kept the first result's `reference` and discarded the accepted reference
that produced the exact match. The classifier retained an `exact` source flag, but
the model-facing candidate schema intentionally removes source flags.

Bottle Aliases are different records. They support display and search, may be
shared by several Bottles, and cannot select a Bottle automatically.

## Hypothesis

Look up the literal input name in accepted, assigned Bottle References at the
shared server boundary. If it resolves an active Bottle, return a deterministic
`match` with no model metadata. Otherwise continue through the unchanged Luna
path. Ignored, unassigned, display-alias-only, and missing records must not
skip Luna.

When candidate retrieval merges an exact result into the same Bottle, retain
the reference carried by that exact result. This preserves the evidence even in
classifier-only and diagnostic paths.

## Baseline evidence

The saved Luna high no-web and web baselines each contained the same two cases
where the literal input equaled an accepted Bottle Reference. Luna passed all
four attempts, but used this work to repeat the stored decision:

| Measure                 | Saved Luna work |
| ----------------------- | --------------: |
| Distinct cases          |               2 |
| Attempts                |               4 |
| Correct attempts        |             4/4 |
| Model requests          |               5 |
| Tool calls              |               1 |
| Input tokens            |          26,934 |
| Output tokens           |           1,959 |
| Reasoning tokens        |           1,223 |
| Total tokens            |          28,893 |
| Estimated model cost    |     $0.00352882 |
| Combined eval-case time |        22.831 s |

These saved attempts ran through the package eval runner, which deliberately
exercises model behavior. They measure the model work that the production
server boundary can avoid; C11 does not rewrite their recorded scores.

## Result

The server entry-point test resolves the accepted reference with
`modelMetadata: null`. Focused comparison cases prove that ignored and unassigned
references, Bottle Aliases, and absent references continue without a
deterministic match. Another comparison case proves that an accepted reference replaces
an earlier vector reference when candidate results merge.

Twenty warmed server calls against the local test database had a 6.50 ms median
and 7.00 ms mean, with a 5.33–15.03 ms range. This path performs database reads
but makes no model or web request.

| Measure                     |      Before |         After |          Change |
| --------------------------- | ----------: | ------------: | --------------: |
| Accepted-reference accuracy |         4/4 |           4/4 |       unchanged |
| Incorrect existing matches  |           0 |             0 |       unchanged |
| Model requests              |           5 |             0 |              -5 |
| Total model tokens          |      28,893 |             0 |         -28,893 |
| Estimated model cost        | $0.00352882 |            $0 |    -$0.00352882 |
| Combined case time          |    22.831 s | about 0.028 s | about -22.803 s |
| Focused server tests        |           — |         12/12 |            pass |
| Classifier package tests    |           — |       420/420 |            pass |

The after-time estimate applies the measured 7.00 ms mean database path to the
four saved attempts. It is a local estimate, not production latency.

The first focused test attempt was invalid because the sandbox blocked the
local test database. The approved rerun reached the database and passed.

## Decision

Keep the change. It preserves accuracy while removing all model tokens, model
cost, and model variability from an identity already accepted in Peated. The
fallback remains unchanged whenever the literal reference is not authoritative.
