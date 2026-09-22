# GPT-6 Luna high versus GPT 5.6 Luna high

**Accepted as the production default.** One full-suite run per model on the
same day passed the same 79 of 105 checks. GPT-6 Luna cost 30.8% less in model
tokens, but its median case was 39.3% slower and it made 23.7% more Firecrawl
calls. The one new unsafe automatic match did not repeat: GPT-6 Luna passed the
focused repeat 3/3 while GPT 5.6 Luna failed it 1/3.

## Change tested

OpenAI released GPT-6 Luna on 2026-09-22. Vercel AI Gateway lists it at half
the GPT 5.6 Luna price per token:

| Model        | Input | Cache read | Cache write | Output |
| ------------ | ----: | ---------: | ----------: | -----: |
| GPT 5.6 Luna | $0.20 |      $0.02 |       $0.25 |  $1.20 |
| GPT-6 Luna   | $0.10 |      $0.01 |      $0.125 |  $0.50 |

Prices are per million tokens. The classifier code changed only where it names
the model: reasoning effort is now sent to GPT-5 and GPT-6 names, and the cost
table gained the GPT-6 Luna row. Prompts, tools, limits, and checks were
unchanged.

Both runs used high reasoning effort for classification and image extraction,
GPT 5.6 Luna medium as the eval judge, at most two search queries, an
eight-turn agent limit, live web evidence, and separate empty replay
directories. The two suites ran concurrently. Source commit `d920eab79`.

## Full-suite results

| Measure                         | GPT 5.6 Luna high | GPT-6 Luna high | Difference |
| ------------------------------- | ----------------: | --------------: | ---------: |
| Passed                          |            79/105 |          79/105 |          0 |
| Wrong existing Bottle selected  |                 1 |               2 |         +1 |
| False-positive accepted results |                 0 |               1 |         +1 |
| Timeouts                        |                 0 |               0 |          0 |
| Cases with model usage          |               101 |             101 |          0 |
| Input tokens                    |         2,846,825 |       3,685,151 |     +29.4% |
| Cached input tokens             |         2,563,311 |       3,303,614 |     +28.9% |
| Cache write tokens              |           282,347 |         380,082 |     +34.6% |
| Output tokens                   |           167,381 |         285,394 |     +70.5% |
| Reasoning tokens                |           120,863 |         226,891 |     +87.7% |
| Total tokens                    |         3,014,206 |       3,970,545 |     +31.7% |
| Model requests                  |               389 |             485 |     +24.7% |
| Firecrawl calls                 |               156 |             193 |     +23.7% |
| Other tool calls                |               101 |             160 |     +58.4% |
| Estimated model cost            |         $0.322944 |       $0.223389 |     -30.8% |
| Median case time                |            22.5 s |          31.4 s |     +39.3% |
| 95th percentile case time       |            60.5 s |          72.6 s |     +19.9% |
| Total case time                 |           2,648 s |         3,502 s |     +32.2% |

On the 99 cases with usage in both runs, cost fell from $0.3170 to $0.2172
while tokens rose from 2,967,775 to 3,870,276. GPT-6 Luna thinks more and
searches more, and its lower price more than covers that. Firecrawl fees are
not in the estimate, so the true saving is smaller than 30.8%.

| Slice             | Cases | GPT 5.6 Luna | GPT-6 Luna |
| ----------------- | ----: | -----------: | ---------: |
| New bottles       |    42 |           27 |         25 |
| Match existing    |    38 |           32 |         34 |
| Corrections       |     1 |            0 |          1 |
| Ignore / no match |    12 |           11 |         11 |
| Bottle audits     |    12 |            9 |          8 |

The GPT 5.6 Luna control passed 79 against the recorded 80 on 2026-09-03, so the
suite behaved as before.

## Changed outcomes

GPT-6 Luna gained five cases:

- The Whistler Bodega Cask name-only source now requires review.
- The image-backed Trestle Spirit of Eclipse photo matched its Bottle.
- Laphroaig Càirdeas 2022 Warehouse 1 matched its Bottle.
- The current-assignment correction case stayed review-only.
- The age-mismatch rejection kept `product` identity scope.

GPT-6 Luna lost five cases:

- Four Roses Limited Edition Small Batch was named `Small Batch` with `2017`
  moved into `edition`.
- Glendalough Double Barrel left `category` null even though the producer page
  it read calls the product a single grain.
- Black Label Islay Origin was named `Islay Origin`.
- Canadian Club Reserve 9-year-old was matched automatically to the
  `Triple Aged Limited Edition` Bottle with a conflicting stored Brand. The test
  requires review.
- The SMWS 10.258 audit update omitted the supported 2013 vintage.

The Four Roses, Black Label, and Glendalough losses are stable-name and field
completeness wobbles already listed in the failure map for GPT 5.6 Luna. The
Canadian Club loss was the only safety-relevant change, so it was repeated.

## Focused repeat: Canadian Club Reserve 9-year-old

Three attempts per model, alternating which model ran first, live web.

| Model        | Correct | Unsafe automatic matches | Model requests | Total tokens | Estimated cost |  Time |
| ------------ | ------: | -----------------------: | -------------: | -----------: | -------------: | ----: |
| GPT 5.6 Luna |     2/3 |                        1 |             18 |      138,743 |      $0.014745 | 129 s |
| GPT-6 Luna   |     3/3 |                        0 |             16 |      122,128 |      $0.007548 | 113 s |

GPT 5.6 Luna made the same unsafe match in its first attempt, with the same
rationale that the age-specific candidate was the safer target. Counting the
full run, each model matched this Bottle unsafely once in four attempts. This
is an existing flaky case, not a GPT-6 regression. It still needs its own fix.

## Decision

Adopt GPT-6 Luna high as the classifier and image extraction default. The
accuracy is the same on this suite, model cost is about 31% lower, and the
safety failure did not reproduce. The cost of adoption is slower cases and more
web calls, which later experiments should try to reduce, for example by testing
GPT-6 Luna at medium effort. The eval judge stays on GPT 5.6 Luna medium so
scores remain comparable.

The [new baseline](../baselines/2026-09-22-gpt-6-luna-high-current.json) pins
this run. Raw reports and recordings were local artifacts under
`.cache/classifier-luna6-comparison-2026-09-22/`; their hashes are in the
[record](./model-gpt-6-luna-2026-09-22.json).

Gateway metadata lists GPT-6 Luna with no zero-data-retention coverage, where
GPT 5.6 Luna had partial coverage. The classifier sends public catalog data,
public source pages, and user-supplied bottle photos. Confirm this is acceptable
under the sensitive-data policy before relying on it for private uploads.
