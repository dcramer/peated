# GPT-6 Luna reasoning effort for photo lookup

**In progress.** Planned before any results were seen.

## Why

Finding a Bottle from a photo takes 60–80 seconds in production. Two traced
runs from 2026-10 spent 11.5–16.8 seconds reading the label and 46–59 seconds
in the classifier, both on GPT-6 Luna high. The
[GPT-6 Luna adoption record](./model-gpt-6-luna-2026-09-22.md) named GPT-6 Luna
at medium effort as the next test for its slower cases.

Expected benefit: shorter label reading and classifier runs with no loss of
accuracy and no new incorrect existing matches.

## Changes tested

Only the reasoning effort changes. Prompts, tools, limits, and checks stay the
same. Source commit `7204701b8`.

1. **Label reading:** `OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT` high
   (control), medium, and low on every case in
   `src/imageExtraction.eval.test.ts`. Three runs per setting, rotating which
   setting runs first: high, medium, low; then medium, low, high; then low,
   high, medium.
2. **Classifier:** `BOTTLE_CLASSIFIER_REASONING_EFFORT` high (control) and
   medium on the full eval suite in pull request CI, one run each, at the same
   time. The control pull request (#1402) adds only this record; the change
   pull request (#1403) also sets the default classifier effort to medium. Label reading stays on high for both. Both
   runs use the same CI environment, web tools, and replay recordings. The
   eval judge stays on GPT 5.6 Luna medium. A first local attempt was void: the test computer
   slept and 88 of 115 cases failed with connection errors.

A setting is worth adopting only if it keeps the pass count within run-to-run
noise, adds no incorrect existing matches or unsupported fields, and is
clearly faster. Raw results stay under `.cache/photo-effort-2026-10-20/`.

## Label reading results

**Not adopted yet.** Medium and low read fields as well as high overall and
are much faster, but they repeat a known production ABV miss.

Each case stops at its first wrong field, so the whole-case pass count hides
most of the result. The table also scores every expected field in every run:
14 cases, 6 field checks per case on average, three runs per setting. A run
error scores every check in that case as wrong. Times cover completed calls.

| Measure                    |    High |  Medium |     Low |
| -------------------------- | ------: | ------: | ------: |
| Field checks passed        | 193/252 | 203/252 | 203/252 |
| Whole cases passed         |   16/42 |   12/42 |   14/42 |
| Run errors (300 s timeout) |       1 |       0 |       2 |
| Median time                |  16.5 s |  10.5 s |   6.1 s |
| 95th percentile time       |  45.6 s |  17.9 s |  10.5 s |
| Slowest completed call     |  61.8 s |  24.2 s | 244.8 s |
| Output tokens, all runs    |  64,170 |  36,153 |  17,259 |

Input tokens were about the same for every setting, 328,000–345,000.

The two cases taken from production ABV misses decide this:

| Case                           | Expected | High          | Medium     | Low        |
| ------------------------------ | -------: | ------------- | ---------- | ---------- |
| Beauchamp Single Malt          |      46% | 46, 46, 40    | 40, 40, 40 | 40, 40, 46 |
| John Crabbie Virgin Oak Peated |      40% | 40, 40, blank | blank ×3   | blank ×3   |

A blank ABV is a safe miss. A wrong ABV can steer the classifier to a different
Bottle. Medium repeats the original Beauchamp miss in every run.

Medium and low did better than high on several Compass Box fields, such as
`bottler` and `edition`. The remaining misses, such as Pōkeno and Willett
`cask_strength` and the SMWS bottler, failed at every setting.

The test computer slept with its lid closed from 10:18 to 10:51. That window
covers the high second run from its third minute and all of the low third run,
including all three timeouts and the 244.8-second low call. Those two runs
must be repeated before the timing and error rows can be trusted. The field
results above do not depend on timing, except for the three cases that never
answered.

Next step: find why lower effort reads the wrong ABV on the Beauchamp label
before deciding. The scoring script is
`.cache/photo-effort-2026-10-20/score-image.ts`.
