# Classifier runtime on the AI SDK

**Status: both parts accepted.** The plan
below was written before any results.

## Expected benefit

Move the Bottle classifier package from the OpenAI SDK and the OpenAI Agents
library to the AI SDK, which the server's other model calls now use. The
expected benefits are one model library across Peated, Sentry tracing that
works the same way for every call, and an output schema the AI SDK sends the
same way to every provider. Accuracy, cost, and time should not change. Any
regression counts against the change.

## Parts

The change ships in two parts, each measured on its own.

1. **Label extraction.** The extractor calls the model with `generateText`
   instead of `responses.create`. It sends the same JSON schema the OpenAI SDK
   helper builds today, the same instructions, the same image detail, and the
   same model and reasoning effort. Photo lookup keeps its 45-second limit and
   no retries. The saved-reading version changes because the request changes,
   so each saved image label is read again once.
2. **Classifier agent loop.** The reference and audit agents run on
   `generateText` with tools and a step limit instead of the Agents runner.
   Prompts, tools, tool limits, and output schemas stay the same.

## Measurement

Both versions run on the same day with the production models: GPT-6 Luna high
for classification and image extraction.

- **Part 1:** `src/imageExtraction.eval.test.ts`, all 14 cases, three runs per
  version. Report passes per case, input, cached, output, and reasoning
  tokens, and time per case.
- **Part 2:** the full classifier suite with the CI evidence snapshot
  (`BOTTLE_CLASSIFIER_EVAL_FIXED_EVIDENCE_FILE=evals/evidence/ci.json`), one
  run per version started together. Report the measures in the experiments
  README. Rerun every case whose result changed in a safety-relevant way three
  times per version, alternating which version runs first.

## Results

### Part 1: label extraction

**Accepted.** Same accuracy, tokens, and time. Five runs per version on
2026-10-29: three of the old code first, then three of the new code, then two
more pairs alternating old and new. Old code ran from a separate checkout of
main at `de27fc090`.

| Measure                       |       Old |       New |
| ----------------------------- | --------: | --------: |
| Passed case-runs              |     33/70 |     36/70 |
| Passes per run                | 5,7,8,6,7 | 8,7,8,6,7 |
| Mean input tokens per case    |     6,998 |     6,998 |
| Mean output tokens per case   |     1,430 |     1,371 |
| Median time per case          |    16.0 s |    16.6 s |
| 95th percentile time per case |    35.2 s |    31.0 s |

Input tokens matched to the token on every case, which shows the same
instructions, schema, and high image detail reached the model. Six cases
changed by one or two passes out of five, in both directions:

| Case                                 | Old | New |
| ------------------------------------ | --: | --: |
| Beauchamp Single Malt production ABV | 0/5 | 1/5 |
| John Crabbie Virgin Oak Peated       | 0/5 | 2/5 |
| Mars Komagatake 2022 Edition         | 4/5 | 5/5 |
| SMWS 95.71 Prepare for Winter        | 4/5 | 3/5 |
| Watchpost American Blended Whiskey   | 5/5 | 4/5 |
| Willett Family Estate barrel 4769    | 1/5 | 2/5 |

These are within the noise of a check that passes 5 to 8 of 14 cases per run.
The comparison covers input and output tokens only; cached and reasoning
tokens were not compared.
Four cases failed every run on both versions: Compass Box Rogues' Banquet,
Compass Box Spice Tree Extravaganza, Pōkeno Single Cask No. 71, and the
SMWS 1.285 replica label.

Other checks:

- A run against a local fake Sentry endpoint sent neither the image bytes nor
  the label text. The model call, its token counts, and the conversation still
  appear.
- A failed read during photo lookup still counts as temporary for a timeout,
  an outage, or a rate limit, as it did with the OpenAI SDK.
- Image URLs pass to the gateway unchanged; the server does not download them.

### Part 2: classifier agent loop

**Accepted by the owner on 2026-10-30, as measured.** Accuracy is within
run-to-run noise and cost is lower. The new runtime made two wrong matches
across ten runs of the two cases involved, against none on main; they were
not measured further. Watch Glen Breton 21 and Classic Cut 2017 in later
suite runs.

Two full-suite pairs on 2026-10-29, each pair started together, with the CI
evidence snapshot and no live web. Old code ran from a checkout of main at
`de27fc090`. The table covers the 129 classifier cases.

| Measure                  | Main, run 1 | New, run 1 | Main, run 2 | New, run 2 |
| ------------------------ | ----------: | ---------: | ----------: | ---------: |
| Passed                   |     112/129 |    114/129 |     116/129 |    111/129 |
| Run errors               |           0 |          0 |           0 |          0 |
| False `no_match` results |           7 |          4 |           3 |          6 |
| False-positive accepts   |           0 |          1 |           1 |          1 |
| Model requests           |         472 |        462 |         478 |        483 |
| Tool calls               |         325 |        315 |         331 |        336 |
| Input tokens             |   4,223,049 |  4,121,078 |   4,296,086 |  4,423,935 |
| Cached input tokens      |   3,823,010 |  3,739,135 |   3,913,272 |  4,042,531 |
| Output tokens            |     247,302 |    228,734 |     244,073 |    223,795 |
| Reasoning tokens         |     195,328 |    177,046 |     191,644 |    172,648 |
| Estimated model cost     |     $0.2119 |    $0.1995 |     $0.2090 |    $0.2000 |
| Median time per case     |      18.1 s |     18.5 s |      22.3 s |     19.6 s |
| 95th percentile per case |      49.3 s |     46.2 s |      51.2 s |     51.5 s |

Combined, main passed 228 of 258 case-runs and the new runtime 225. Output
and reasoning tokens fell about 8% and model cost 4–6%.

Results that differed between versions across the two pairs:

- **Better on new:** four existing-match cases (ordinary Ardbeg Ten, the
  dropped possessive brand, the existing Cadboll Estate 15, and the existing
  Lagavulin Distillers Edition) passed 2 of 2 on new against 1 of 2 on main.
  The Proof and Wood audit passed 2 of 2 against 0 of 2.
- **More conservative on new:** Octomore 13.1 and the 43% Macallan 12
  creation passed 0 of 2 on new against 2 of 2 on main, once each by
  returning `no_match` instead of creating.
- **Safety:** two unsafe accepts appeared on new in run 1. Glen Breton 21
  matched Bottle 16270 when it should create a new Bottle. The Classic Cut
  2017 auction title matched Bottle 3277 when it should be `no_match`. Three
  repeats of each case per version, alternating which version ran first, did
  not reproduce either: new created Glen Breton twice and returned a safe
  `no_match` once, and returned `no_match` for Classic Cut all three times.
  Main passed both all three times. Across five runs of each case, new made
  each unsafe accept once and main never did.

Runtime changes that reached the model:

- Tool schemas match the Agents library's except that `format` keywords are
  removed. The gateway's AI SDK route rejects `uri` in strict tool schemas;
  the old OpenAI-compatible route accepted it.
- One tool call per turn (`parallelToolCalls: false`), the same turn limits,
  the same reasoning effort, and the same output schemas.
- Tool outputs reach the model as JSON objects through the AI SDK instead of
  strings serialized by the Agents library.
