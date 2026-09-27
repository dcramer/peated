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
- Commit replay recordings required by a deliberate test case or test runner change.
  Do not record a provider failure as empty evidence.
- For a controlled classifier comparison, give both variants the same reviewed
  evidence pack keyed by test case ID. Query-keyed replay is insufficient when a
  prompt change can alter the query. Run current live web behavior separately.
- Run focused model checks while changing model behavior. Run the full suite
  once at a deliberate full-suite run.

## Capture a production miss

Store-price and review classifier runs are saved as Bottle checks with the full
input, decision, and artifacts. To turn a wrong decision into a test case:

1. Find the source record. The moderation history entry for the decision gives
   its source kind and ID.
2. Fetch the saved run with the authenticated CLI:
   `pnpm cli api get '/audits/runs?sourceKind=review&sourceId=123' > run.json`.
3. Draft the test case and its evidence pack:
   `node packages/bottle-classifier/scripts/draft-eval-fixture.mjs run.json <fixture-id> <out-dir>`.
4. Verify the Bottle online, write `expected`, complete `provenance`, and move
   the test case into `src/eval-fixtures/decision-cases/`. The validator rejects
   the draft until you do.

Do not rely on Sentry for this. It keeps only some classifier runs and cuts
long inputs and tool outputs.

## Pull request checks

- Add `trigger-evals` to run classifier model checks.
- Add `trigger-evals-scraper` to run scraper model checks.
- Scraper model checks also run automatically when files under
  `apps/server/src/scraper/configured/` change in an internal pull request.
- Ordinary `pnpm test` runs do not call a model.

Exact wording or tool order can be checked when it is the product contract.
