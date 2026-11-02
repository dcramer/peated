# Entity classifier on the AI SDK

**Status: measured, even with main.** The plan below was written before the
measured runs. One smoke run of the new code came first, to prove the check
works. It is not part of the results, and no case changed after it.

## Expected benefit

Move the Entity classifier from the OpenAI Agents library to the AI SDK and
share one agent loop with the Bottle classifier in `@peated/agent-run`. Answers
should not get worse. Cost and time should stay about the same.

## Exact change

- `createEntityClassifier` takes `languageModel` instead of `client`.
- Tools use `strictAgentTool`, and the run uses `runAgent`.
- Prompts, tools, the 8-turn limit, the model, and search limits do not change.

## Cases

The 12 cases in `cases.ts` are real Entity rows, each with a recorded source for
its answer. They cover all six advice kinds. This is the first model check for
the Entity classifier, so it has no earlier scores. Web tools read only the
saved passages in `pages.json`.

`context` is built by hand from public Entity and Bottle data, in the shape the
server builds. It is not a saved `audit-candidates` response.

## Method

- Main at the merge base, with this check added, against this branch.
- Three runs per version, alternating which version goes first.
- Same model (`OPENAI_MODEL`), through AI Gateway.
- Report passes, wrong targets, advice kinds that changed, errors, tokens, and
  time. Review changed results, not just the total.

## Results

Six runs on 2026-11-01, on GPT-6 Luna at its default effort. Main ran from
`e9d47a1ff` with this check added. Order was main, new; new, main; main, new.

| Measure               |       Main |        New |
| --------------------- | ---------: | ---------: |
| Passed, runs 1, 2, 3  | 10, 11, 10 | 10, 11, 11 |
| Passed, of 36         |         31 |         32 |
| Wrong target Entity   |          0 |          0 |
| Run errors            |          0 |          0 |
| Model calls           |        119 |        125 |
| Input tokens          |    152,316 |    162,956 |
| Cached input tokens   |    129,820 |    153,793 |
| Output tokens         |     10,960 |     11,308 |
| Reasoning tokens      |      5,720 |      5,622 |
| Estimated model cost  |    $0.0090 |    $0.0081 |
| Median time per case  |      6.1 s |      5.6 s |
| 95th percentile, case |     13.0 s |     12.7 s |

- **Accuracy:** one case-run apart, which is within run-to-run noise.
- **Always failed on both:** Rampur returned `no_issue` in all six runs, not
  `metadata_issue`. The page shows a distillery name, but the model would not
  call the Brand row wrong. This is the case or the prompt, not the runtime.
- **Changed results:** the Celtic Whisky case returned `insufficient_evidence`
  once on each version. The Bernheim case did that once on main. Both are safe
  misses: no version called either pair a duplicate.
- **Cost:** new sent 6% more input but cached more of it. Cache share depends
  on what ran just before, so treat the cost difference as noise. Firecrawl is
  not counted, because these runs read saved pages.

**Limits:** 12 cases, three runs each. This shows no sign of a regression. It
is too small to show an improvement. Live web reads, and the rules in
`audit-candidates`, were not part of these runs.
