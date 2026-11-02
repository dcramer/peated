# About writer on the AI SDK

**Status: measured, even with main.** The plan below was written before the
measured runs. One smoke run of the new code came first, to prove the check
runs and to measure its time. It is not part of the results, and no case
changed after it.

## Expected benefit

Move the About writer from the OpenAI Agents library to the AI SDK, on the
agent loop in `@peated/agent-run` that both classifiers use. That removes
`@openai/agents` from Peated. Drafts should not get worse. Cost and time should
stay about the same.

## Exact change

- Tools use `strictAgentTool`, the answer schema uses `agentOutput`, and the
  run uses `runAgent` with `createLanguageModel`.
- Each run gets a Sentry conversation ID, `entity_about:<entityId>`, as the
  model call guide asks.
- Prompts, tools, web budget, the 128-turn limit, the model, and its default
  reasoning effort do not change. Neither version sets a temperature.

## Cases

The 12 cases in this folder, unchanged. Each runs the real job, with its
checks and one retry, against saved pages only.

## Method

- Main at `7b72b8a92` against this branch.
- Three runs per version, alternating which version goes first.
- Same model (`OPENAI_MODEL`), through AI Gateway.
- Report saved drafts, failed cases and why, errors, model calls, tokens, and
  time. Review changed results, not just the total.

## Results

Six runs on 2026-11-02, on GPT-6 Luna at its default effort. Order was main,
new; new, main; main, new. Cost uses the GPT-6 Luna prices in
`packages/bottle-classifier/src/runtime/cost.ts`.

| Measure                        |       Main |        New |
| ------------------------------ | ---------: | ---------: |
| Passed, runs 1, 2, 3           |  10, 10, 8 |  9, 10, 11 |
| Passed, of 36                  |         28 |         30 |
| Run errors                     |          0 |          0 |
| Model calls                    |      1,264 |      1,216 |
| Input tokens                   | 19,782,411 | 18,074,764 |
| Cached input tokens            | 19,231,020 | 17,527,716 |
| Output tokens                  |    415,985 |    371,353 |
| Reasoning tokens               |    271,761 |    224,612 |
| Estimated model cost, six runs |     $0.469 |     $0.429 |
| Median time per case           |      126 s |      143 s |
| 95th percentile, case          |      320 s |      289 s |

Failed case-runs:

| Case       | Main                       | New                    |
| ---------- | -------------------------- | ---------------------- |
| diageo     | runs 1, 2, 3               | runs 1, 2, 3           |
| thin       | runs 2, 3                  | run 2                  |
| smws       | run 1: no 2004 acquisition | —                      |
| brora      | run 3: rejected draft      | —                      |
| clynelish  | run 3: skipped             | run 1: no 1967 opening |
| port-ellen | —                          | run 1: no 1825 opening |

- **Accuracy:** two case-runs apart, within run-to-run noise. Every miss
  outside Diageo happened in only one or two of a version's three runs.
- **Always failed on both:** Diageo never kept its generic 2013 event. This is
  the case or the prompt, not the runtime.
- **Thin:** the 2020 opening is missed by both versions, more often on main.
- **Brora, main run 3:** the job rejected the draft, and its retry, for
  listing the `return` section twice.
- **Clynelish, main run 3:** the job returned `skipped`, which it does when
  the Entity is missing or its page changed during the run. Other sessions
  share the local test database, which is the likely cause. This is not
  confirmed.
- **Cost and time:** new used 4% fewer calls and 9% less cost. Its median case
  was slower and its slowest cases faster; total time was about the same.

Limits: the check prints each failed case's drafts, but the JSON reporter used
for these runs did not keep that output, so the review above uses the failure
messages only. Token counts come from the gateway's responses.
