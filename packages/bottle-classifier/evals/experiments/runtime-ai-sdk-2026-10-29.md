# Classifier runtime on the AI SDK

**Status: part 1 accepted; part 2 in progress.** The plan below was written
before any results.

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
