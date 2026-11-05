# Model Checks (Evals)

## Purpose

A model check runs model-facing behavior through the real classifier code. It measures
judgment that a repeatable code test cannot prove.

## Rules

- Keep model checks separate from `pnpm test`. Run them with `pnpm evals`.
- Use realistic input. Do not steer a test case toward its expected answer.
- Check structured outcomes and product rules, not incidental wording or an
  exact internal sequence.
- Do not copy test case names, exact inputs, expected answers, or distinctive
  phrases into a product prompt.
- Find the layer that owns a failure before editing: input context, retrieval,
  tool execution, model judgment, code review, integration, or the expectation.
- Use normal tests for schemas, transport, persistence, permissions, and other
  behavior owned by code.
- Check exact structured fields directly. Use a model judge only for subjective
  output.
- A production-miss test case must preserve the observed input, independently
  verify the subject, state the intended outcome, and record its source.
- Keep the production test case after a fix. Add a second case with different
  concrete values to prove the general rule.
- A decision case whose expected answer is right but not reached yet gets
  `knownFailure: { reason, fixedBy }`. Default runs and CI leave it out, so
  the pass rate covers only cases expected to pass. It runs when selected by
  id or with `BOTTLE_CLASSIFIER_EVAL_INCLUDE_KNOWN_FAILURES=1`. The change
  that fixes it removes the mark, and the case must then pass. Never mark a
  case only to raise the pass rate.
- Commit replay recordings required by a deliberate test case or test runner change.
  Do not record a provider failure as empty evidence.
- For a controlled classifier comparison, give both variants the same reviewed
  evidence pack keyed by test case ID. Query-keyed replay is insufficient when a
  prompt change can alter the query. Run current live web behavior separately.
- A decision fixture may set `webEvidenceFile` to a package-relative reviewed
  evidence pack. This makes its evidence available in CI without web credentials.
  `BOTTLE_CLASSIFIER_EVAL_FIXED_EVIDENCE_FILE` overrides that fixture default.
- A behavior change keeps its targeted model check, and the pull request's
  `trigger-evals` run proves it once. Do not rerun model checks locally to
  compare variants or to measure production; use Sentry (see below).

## Measure production

Production classifier behavior is measured from Sentry, not by rerunning
model checks. Every reference run, on every path, has one
`bottle_classifier.reference` span with these fields:

- `bottle_classifier.path`: what settled it, `rule`, `scope_precheck`,
  `smws_code`, `exact_reference`, or `agent`.
- `bottle_classifier.status` and `bottle_classifier.action`: `classified` or
  `ignored`, and `match`, `create_bottle`, `no_match`, or `ignore`.
- `bottle_classifier.identity_scope`, `bottle_classifier.web_evidence`,
  `bottle_classifier.risk_categories`, `bottle_classifier.risk_count`, and
  `bottle_classifier.candidate_count`.
- `bottle_classifier.workload`: `application` or `scraper`.

The span's root transaction names the source, such as
`bullmq.resolveauctionlot` for auction lots, `bullmq.resolvestorepricebottle`
for store listings, and `bullmq.createmissingbottles` for reviews. The AI SDK's
spans under it carry model calls, tool calls, tokens, and time.

Each listing, auction lot, and review also logs `Bottle resolution recorded`
with `sourceKind`, `sourceId`, `outcome` (`automatic`, `review`, or `ignored`),
`action`, and `automationBlockers`, the reasons the shared Bottle resolution
check held a decision for review. Count these in Sentry Logs for the
automation rate and its causes by source.

Example, runs by path and action over a week:

```bash
sentry api "/organizations/peated/events/?dataset=spans&field=bottle_classifier.path&field=bottle_classifier.action&field=count()&query=span.op:bottle_classifier.reference&statsPeriod=7d"
```

## Capture a production miss

Store-price, review, and auction lot classifier runs are saved as Bottle checks
with the full input, decision, and artifacts. An auction lot run uses
`sourceKind=auction_lot` and the lot ID. To turn a wrong decision into a test case:

1. Find the source record. The moderation history entry for the decision gives
   its source kind and ID.
2. Fetch the saved run with the authenticated CLI:
   `pnpm -s cli api get '/audits/runs?sourceKind=review&sourceId=123' > run.json`.
3. Draft the test case and its evidence pack:
   `pnpm --filter @peated/bottle-classifier fixtures:draft "$PWD/run.json" <fixture-id> "$PWD/<out-dir>"`.
4. Verify the Bottle online, write `expected`, complete `provenance`, and move
   the test case into `src/eval-fixtures/decision-cases/`. The validator rejects
   the draft until you do.

Sentry also records each classifier run as one conversation, with its complete
input and every tool call and result, but only for Sentry's retention period.
`fixtures:draft` reads the saved run, which does not keep the agent's own tool
results, so add catalog search replies and page passages from the trace by
hand when a case needs them.

## Pull request checks

- Add `trigger-evals` to run classifier model checks.
- The `evals / classifier score` status on the pull request shows the pass
  rate, for example `73.6% passed (103/140) · needs 80%`. It links to the run,
  whose summary lists each failed case. The `evals / classifier` job fails when
  the pass rate is below the floor set by `EVAL_MIN_PASS_RATE` in
  `.github/workflows/evals.yml`.
- Classifier CI sets `BOTTLE_CLASSIFIER_EVAL_FIXED_EVIDENCE_FILE` to
  `evals/evidence/ci.json`. This reviewed snapshot covers every classifier and
  audit case. Missing case or image coverage fails validation before model
  calls. Web search and page reads use only that case's saved evidence; a
  saved page's reviewed passages stand in for its text, so `find_in_page`
  searches only what a reviewer saw. Image reads use their saved extraction.
  Unreviewed pages and images never fall through to a live provider.
- Empty search evidence explicitly marks a local-input-only case. Saved
  upstream extractions may preserve known errors from the captured run; they
  are inputs for classifier judgment, not assertions about the correct result.
  The separate label-extraction model checks still read checked-in image bytes
  through the live extraction model.
- To run the same controlled suite locally, set the fixed-evidence variable to
  `evals/evidence/ci.json` and run `pnpm evals:classifier`. For a separate
  live-web check, set it to an empty string and supply Firecrawl credentials.
  This disables both the CI snapshot and individual fixture evidence defaults.
- Add `trigger-evals-scraper` to run scraper model checks.
- Scraper model checks also run automatically when files under
  `apps/server/src/scraper/configured/` change in an internal pull request.
- The About writer check, `apps/server/src/agents/entityAbout/writer.eval.test.ts`,
  is a server model check, so `trigger-evals-scraper` runs it too. Its writer
  reads only the reviewed pages in `apps/server/src/agents/entityAbout/evals/`,
  so it needs no Firecrawl key. A failed case prints each draft's facts,
  citations, and which quotes the checks kept. A case expects only events
  the rules require a careful writer to keep. Generic events and disputed
  owners are optional, so the case's notes list them instead. When the
  sources split on an event's kind, such as closed and mothballed, the case
  lists each kind. Run it alone with
  `pnpm --filter @peated/server evals -- src/agents/entityAbout/writer.eval.test.ts`.
- The Entity classifier check,
  `apps/server/src/agents/entityClassifier/classifier.eval.test.ts`, is also a
  server model check that `trigger-evals-scraper` runs. Its 12 cases in
  `evals/cases.ts` are real Entity rows, each with a recorded source for its
  answer. Its web tools read only the saved passages in `evals/pages.json`, so
  it needs no Firecrawl key. It compares the advice kind and target Entity. A
  safer `insufficient_evidence` still fails a case that has a clear answer.
  Run it alone with
  `pnpm --filter @peated/server evals -- src/agents/entityClassifier/classifier.eval.test.ts`.
- The AI SDK model check, `apps/server/src/lib/aiSdkModels.eval.test.ts`,
  also runs with `trigger-evals-scraper`. It only confirms that the decision
  model in `DECISION_MODEL` (Jev by default) and the default language model
  answer through AI Gateway, and that the `reasoning` setting takes effect.
  A feature that calls one of these models needs its own model check with
  labeled cases. See [Model Calls](./model-calls.md).
- The country, region, and Entity detail checks
  (`apps/server/src/worker/jobs/generate*Details.eval.test.ts`) also run with
  `trigger-evals-scraper`. They check the structure of each answer and one
  well-known fact per case, such as Scotland's three-year minimum age. They
  do not judge the writing.
- Ordinary `pnpm test` runs do not call a model.

Exact wording or tool order can be checked when it is the product contract.
