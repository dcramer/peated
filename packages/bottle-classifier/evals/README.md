# Classifier eval baselines

The [current 105-case Luna high baseline](./baselines/2026-09-03-luna-high-current.json)
pins the source commit, test-case hashes, run settings, aggregate results, and
raw report hash. The findings from the first fourteen experiments are summarized
in the dated
[research record](../../../docs/research/bottle-classifier-evaluation-2026-09.md).
The comparison below is the earlier six-model-setting snapshot.

The [2026-09-03 baseline](./baselines/2026-09-03.json) records all 102 test cases
across six full-suite runs, plus targeted repeats. It includes model settings,
per-case outcomes, test case and raw-report SHA-256 hashes, and Luna high's
failed checks. Test case paths are relative to the package root.

These are historical observations, not expected failures. The suite still scores
every case against its existing expectations. Keep this snapshot unchanged when
fixing a test case or changing the classifier; record a new baseline with its
source commit and test case hashes.

[M02](./experiments/M02-policy-conflicts.md) later corrected two Jameson Cold
Brew expectations. Its result records the adjusted counts without rewriting
this historical snapshot.

[M03](./experiments/M03-names-and-categories.md) later corrected the Black
Label Islay Origin and Hedonism² categories, Hedonism²'s year field, and the
Maker's Mark stable name. Its expectation-only rescore also leaves this
historical snapshot unchanged.

[M04](./experiments/M04-supported-audit-extras.md) allows an audit test case to
enumerate exact reviewed operation sets that contain all required repairs.
Unlisted operations and extra findings remain failures. Its rescore also leaves
the historical snapshot unchanged.

[M05](./experiments/M05-fixed-evidence.md) adds reviewed evidence packs keyed by
test case ID. A controlled run supplies that evidence before the model starts and
serves only reviewed page results if the model uses a web tool. A separate live
web run measures current retrieval behavior. This changes the eval runner, not
the classifier instructions or production default.

[M06](./experiments/M06-fixed-image-extraction.md) extends those packs with
reviewed image extractions. Controlled audit versions receive the same parsed
label fields and make no live image-model request for a reviewed image.

[M09](./experiments/M09-whistler-release-ambiguity.md) changes the name-only
Whistler Bodega Cask case to require review because producer and exact-product
evidence disagree on ABV. Its rescore leaves the historical snapshots unchanged.

[M10](./experiments/M10-woodford-release-ambiguity.md) changes the name-only
Woodford Reserve Double Double Oaked case to require review because the
producer markets separate yearly releases. Its rescore also leaves the
historical snapshots unchanged.

## With web evidence

All settings used Luna high for image extraction, at most two search queries,
and an eight-turn agent limit. Each setting ran the full suite once.

| Classifier   | Passed | Incorrect existing matches | Timeouts | Median time | Token cost, same 93 cases |
| ------------ | -----: | -------------------------: | -------: | ----------: | ------------------------: |
| Terra medium | 76/102 |                          2 |        0 |      13.8 s |                   $1.6235 |
| Luna high    | 73/102 |                          3 |        0 |      19.4 s |                   $0.2757 |
| Luna xhigh   | 73/102 |                          2 |        3 |      28.0 s |                   $0.4369 |

“Incorrect existing match” means selecting a different Bottle ID or returning
`match` where the test case requires another action. A failed creation-field check
does not count as an incorrect existing match. Failures include run errors;
the JSON records those separately, with timeouts included in run failures.

| Slice             | Cases | Terra medium | Luna high | Luna xhigh |
| ----------------- | ----: | -----------: | --------: | ---------: |
| New bottles       |    41 |           27 |        23 |         25 |
| Match existing    |    39 |           34 |        34 |         34 |
| Corrections       |     1 |            1 |         1 |          1 |
| Ignore / no match |    10 |           10 |        10 |          7 |
| Bottle audits     |    11 |            4 |         5 |          6 |

Two risky cases were repeated twice after the full runs. Across all three
attempts, Luna high incorrectly matched the barrel-specific Elijah Craig
candidate 3/3 times and the barrel-specific Masterson's candidate 3/3 times.
Terra passed the Masterson's case 2/3 times; none of the three settings passed
the Elijah Craig case. These repeats were selected after inspecting failures,
so they describe those cases, not overall accuracy.

## Without web evidence

| Classifier   | Passed | Incorrect existing matches | Timeouts | Median time | Token cost, same 99 cases |
| ------------ | -----: | -------------------------: | -------: | ----------: | ------------------------: |
| Terra medium | 74/102 |                          1 |        0 |      10.0 s |                   $1.2532 |
| Luna high    | 75/102 |                          1 |        0 |      10.9 s |                   $0.2034 |
| Luna xhigh   | 73/102 |                          3 |        1 |      14.3 s |                   $0.2892 |

Do not compare the two tables' costs as a measurement of web overhead: their
eligible case subsets differ. Costs are estimates from each call's actual model
and reported token/cache usage, including image extraction. They exclude cases
with missing usage, no-model cases, Firecrawl charges, and provider adjustments.
The prices used per million tokens were:

| Model | Input | Cache read | Cache write | Output |
| ----- | ----: | ---------: | ----------: | -----: |
| Terra | $2.00 |      $0.20 |       $2.50 | $12.00 |
| Luna  | $0.20 |      $0.02 |       $0.25 |  $1.20 |

Web runs started with separate empty replay directories per setting. New web
requests were live; identical requests could replay, including in repeats.
Catalog lookups used public test data. Retrieval, model variability, cache
state, and host timing were not controlled; suites ran concurrently. The
configured timeout was 300 seconds, but some reported durations exceeded it.
One run per setting does not establish that high is more accurate than xhigh.

## Accuracy experiments

Use **Luna high** for the next experiments and keep image extraction on Luna
high. Luna high is also the production default after this comparison. The
[failure analysis](./analysis-2026-09-03.md) identifies the first experiment and
the scoring conflicts to resolve separately.

The [experiment log](./experiments/README.md) records each change, its measured
results, and the decision to keep or reject it, including unsuccessful attempts.
The [Luna high failure map](./failure-map-2026-09-03.md) records the exact
remaining saved failures, their owning layer, and the next case-specific test.

Run from the repository root, with model and Firecrawl credentials available in
`.env.local` or the environment. Use a new run directory for each experiment:

```bash
mkdir -p .cache/classifier-luna-experiment-01
BOTTLE_CLASSIFIER_MODEL=gpt-5.6-luna \
BOTTLE_CLASSIFIER_REASONING_EFFORT=high \
OPENAI_IMAGE_EXTRACTION_MODEL=gpt-5.6-luna \
OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT=high \
BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES=2 \
VITEST_EVALS_REPLAY_MODE=auto \
VITEST_EVALS_REPLAY_DIR="$PWD/.cache/classifier-luna-experiment-01/recordings" \
pnpm --filter @peated/bottle-classifier evals -- \
  src/classifier.eval.test.ts \
  --reporter=vitest-evals/reporter --reporter=json \
  --outputFile.json="$PWD/.cache/classifier-luna-experiment-01/results.json"
```

For a focused run, append `-t '<case-name pattern>'`. Missing Firecrawl credentials
disable web tools, so that run belongs to the no-web comparison. Keep environment
and evidence settings with each result. For a controlled comparison, create a
reviewed evidence pack under `evals/evidence/`, keyed by test case ID, and set
`BOTTLE_CLASSIFIER_EVAL_FIXED_EVIDENCE_FILE` to its package-relative path. Both
versions then start with the same evidence. Query-keyed replay alone is not a
controlled comparison because prompt versions can ask different questions.
Leave the fixed-evidence variable unset for the separate live-web check. Compare
fresh model decisions, not cached model answers.

Set `BOTTLE_CLASSIFIER_EVAL_FIXTURE_IDS` to comma-separated test case IDs for a
focused run. This exact filter avoids selecting other test cases with similar
names.

Report action/ID correctness, unsupported existing matches, creation-field
correctness, audit grounding, run failures, latency, and token cost separately
from the all-judges pass count. Repeat the focused changed and unchanged runs before
one full-suite run. Review every changed outcome, including new failures.

The original raw reports and recordings were local artifacts under
`.cache/classifier-{luna,web}-comparison-2026-09-03/`; they are not committed.
Their report hashes are retained in the baseline, but this compact snapshot does
not contain complete transcripts or make the live runs exactly reproducible.
