# C27: Ignore explicit multi-item listings before extraction

**Decision: Accepted.**

## Problem

Gift sets, bundles, and multi-bottle listings do not identify one Bottle. The
classifier already ignored several clear title patterns, but only after text
extraction. Two structural forms in the production review queue were also
missing: an explicit bottle count such as `8 Bottles`, and count words such as
`Dual Pack`, `Combo Pack`, or `Trilogy Set`.

This matters during an outage. On September 4, 2026, provider budget errors
accounted for 99 of 100 oldest sampled errors and 96 of 100 newest sampled
errors. A listing that depends on extraction cannot reach the existing ignore
rule while that provider call is failing.

## Change

- Recognize a numeric bottle count.
- Recognize `dual`, `duo`, `trio`, `trilogy`, or `combo` followed by a pack,
  set, bundle, or collection word.
- Run bundle, multi-bottle, and damaged-condition title checks before text
  extraction when no extraction was supplied by the caller.

The early check does not include the broader non-whisky rule. A whisky title
can contain another spirit word as a maturation fact, so that rule still waits
for extraction.

## Production sample

Read-only queue searches for `gift`, `pack`, `bottles`, `bundle`, and `sampler`
returned 37 distinct actionable listings. This was a selected keyword sample,
not an estimate of the whole queue.

| Measure                                 | Before | After |
| --------------------------------------- | -----: | ----: |
| Listings recognized as multi-item       |  16/37 | 26/37 |
| Listings newly recognized               |      — |    10 |
| Text extraction for recognized listings |      1 |     0 |
| Classifier-agent calls                  |      0 |     0 |
| Model tokens after the change           |      — |     0 |
| Model cost after the change             |      — |    $0 |

The ten added cases were three structural pack names and seven titles that
stated `8 Bottles`. Existing bundle and sampler cases remained recognized.
`Bottled in Bond` and `The Gifted Horse` are negative controls and continue to
the classifier.

Wall-clock savings were not measured because the sampled production records
were inspected without rerunning paid extraction. The change removes one text
extraction request from every title it recognizes.

## Verification

- The focused classifier tests pass, including the positive and negative
  controls.
- Package type checking passes.
- No live Luna run is needed: the accepted path makes no model request and the
  test asserts that extraction, catalog search, and the classifier agent are
  not called.

## Limit

This clears obvious noise cheaply, but the sample shows only ten additional
queue items. It cannot by itself move overall automation close to 80%.
