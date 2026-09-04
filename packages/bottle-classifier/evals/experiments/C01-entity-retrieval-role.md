# C01: preserve why an Entity was retrieved

**Rejected and reverted.** The change improved reuse of the correct Entity for
Mars, but it missed the pre-run no-regression condition, used more tokens, and
was slower. The pre-run plan below is retained before the results.

## Hypothesis

Initial Entity retrieval currently stores only the query text. The prompt says
that `retrievedFor` identifies the source field, but the model cannot tell
whether a result came from the extracted Brand, Series, bottler, distillery, or
a candidate relationship. Preserving that field should help Luna reuse an
existing Entity in the right Bottle relationship.

The eval runner will also record the model's raw decision before final cleanup.
This separates a model choice from the deterministic rule that clears an Entity
ID when its returned name does not match the catalog name or alias.

## Exact change

- Add a `sourceField` to each initial `retrievedFor` entry.
- Preserve every source field when the same query is used for more than one
  role, without making another catalog request.
- Deduplicate source records by query and source field.
- Correct the input description so it names the fields the classifier supplies.

No Bottle matching rule, Entity-name validation rule, tool limit, output schema,
or production model setting will change.

## Cases and success conditions

| Case                           | Why selected                                                                              | Required result                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Mars Komagatake 2022 Edition   | Target failure: Entity 1953 owns the historical distillery alias                          | Raw and final draft reuse Entity 1953 as distiller; no new Entity                                |
| Watchpost Whiskey              | Target and different names: candidate context establishes Westland Distillery Entity 1987 | Keep or improve reuse of 1987; do not replace it with a duplicate                                |
| Whiskyland Chapter Twenty Nine | Target with Brand, Series, bottler, and distiller roles split across Entities             | Use Whiskyland 365738 as Brand, Decadent Drinks 5775 as bottler, and Glenturret 987 as distiller |
| SMWS RW6.5 Appley ever after   | Unchanged case with one Entity in Brand and bottler roles plus a separate distiller       | Remain a correct exact-cask creation with Entity IDs 4263 and 127                                |

Overall all-judge results will also be reported, but C01 is accepted only if
Entity choices improve without a new incorrect Bottle match, unsafe Entity ID,
run error, or regression in an comparison case. A raw correct ID that final cleanup clears
will be diagnosed separately and will not count as a completed fix.

## Run design

Use Luna high, the same reviewed fixed evidence pack, test catalog data,
two-query limit, and eight-turn limit for both versions. Run each case three
times per version. Pair order is unchanged/changed, changed/unchanged, then
unchanged/changed. Record full score, Entity choices before and after cleanup,
incorrect matches, errors, input/output/cache/reasoning tokens, estimated model
cost, tool calls, and elapsed time. Run a full suite only if the focused result
is a net win.

## Results

Each version ran the four cases three times. There were no incorrect Bottle
matches, planned-case run errors, or live Firecrawl requests.

| Case       | Unchanged |  Changed | What changed                                                                                                                               |
| ---------- | --------: | -------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Mars       |       0/3 |      2/3 | Entity 1953 replaced one wrong duplicate ID and one null ID; one changed run still returned a null ID.                                     |
| Watchpost  |       3/3 |      3/3 | Existing Westland Distillery 1987 remained stable.                                                                                         |
| Whiskyland |       2/3 |      1/3 | All raw drafts chose the correct Entity IDs. Two changed drafts also repeated Whiskyland as Series, so cleanup changed them to `no_match`. |
| SMWS       |       3/3 |      3/3 | Brand/bottler Entity 4263 and Kyrö 127 remained stable. One raw `SMWS` alias was replaced with the stored name.                            |
| **Total**  |  **8/12** | **9/12** | One net pass, with a regression on a pre-registered target.                                                                                |

The raw-decision capture showed that final cleanup did not cause the Mars
failure. The unchanged model chose Entity 238555 once and no Entity ID twice.
The changed version chose 1953 twice and no ID once. For Whiskyland, cleanup did what it
should: it rejected a draft that used the same Entity as both Brand and Series.

## Cost, tokens, and time

| Measure                                | Unchanged |   Changed | Difference |
| -------------------------------------- | --------: | --------: | ---------: |
| Input tokens                           |   182,946 |   187,811 |     +4,865 |
| Output tokens                          |    17,457 |    17,052 |       -405 |
| Total tokens                           |   200,403 |   204,863 |     +4,460 |
| Cached input tokens                    |   163,619 |   174,082 |    +10,463 |
| Cache-write tokens                     |    19,234 |    13,636 |     -5,598 |
| Reasoning tokens                       |    12,387 |    11,947 |       -440 |
| Model requests                         |        31 |        31 |          0 |
| Tool calls                             |        19 |        19 |          0 |
| Estimated model cost                   | $0.029048 | $0.027372 | -$0.001676 |
| Estimated cost without cache discounts | $0.057538 | $0.058025 | +$0.000487 |
| Total model-run time                   |  177.51 s |  198.95 s |   +21.45 s |
| Median case time                       |   15.48 s |   16.50 s |    +1.02 s |
| Case-time p95, nearest rank            |   24.59 s |   25.88 s |    +1.29 s |

The lower measured cost for the changed version came from more cache reads. At
uncached rates, the changed version was slightly more expensive. Its time rose 12.1%.
The exact `retrievedFor` data added no catalog or model requests; the token and
time differences include normal model variability.

Median/p95 times by case were:

| Case       | Unchanged       | Changed         |
| ---------- | --------------- | --------------- |
| Mars       | 18.24 / 24.59 s | 20.60 / 25.88 s |
| Watchpost  | 16.10 / 16.47 s | 17.48 / 21.26 s |
| Whiskyland | 14.85 / 16.12 s | 15.52 / 20.28 s |
| SMWS       | 9.28 / 10.53 s  | 9.42 / 12.96 s  |

## Decision

Reject and revert the Entity source-field change. A one-pass aggregate gain
does not outweigh the Whiskyland regression and 12.1% time increase under the
recorded acceptance rule. The Mars result is promising evidence for a later,
narrower change that makes exact aliases easier to reuse without emphasizing a
possibly wrong extracted role.

Keep the raw-decision observer and exact test-case ID filter as measurement tools.
They do not change classifier decisions. No full model suite was run because the
focused change did not qualify.

Two setup failures are retained:

- The first unchanged-run title filter also selected three similarly named SMWS
  test cases. They failed fixed-pack lookup before any model call. The four
  planned unchanged results remain valid and are included above.
- The first exact-ID run defined four empty eval suites, which Vitest reported
  as suite errors after the four planned model cases finished. Empty suites are
  now omitted. These errors used no model tokens and did not alter the planned
  case results.

## Verification

- Focused classifier and fixed-evidence tests: 66 passed.
- Package typecheck, lint, and formatting: passed.
- Full deterministic run during the measurement work: 401 passed.

The [structured results](./C01-entity-retrieval-role.json) contain the exact
aggregates, case outcomes, and setup failures.
