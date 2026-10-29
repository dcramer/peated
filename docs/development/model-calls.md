# Model Calls

## Purpose

How server code calls hosted models: keys, clients, settings, errors, and
tracing. For live model checks, see [Model Checks](./model-checks.md). For
rules on model-driven features, see
[Agent Design](../policies/agent-design.md).

## Gateway And Keys

- Every hosted model call goes through Vercel AI Gateway. Production stops at
  startup when `AI_GATEWAY_API_KEY` is missing.
- Each call names a workload. `application` uses `AI_GATEWAY_API_KEY`.
  `scraper` uses `SCRAPER_AI_GATEWAY_API_KEY` when it is set, and the
  application key otherwise.
- Model names carry a provider prefix, such as `openai/gpt-6-luna` or
  `typesafe-ai/jev`. The `OPENAI_*` and `BOTTLE_CLASSIFIER_*` model settings
  add `openai/` to a name without one. Other model settings need the full
  name.
- Model settings and their defaults are listed in `.env.example`. The
  classifier settings are in the
  [classifier README](../../packages/bottle-classifier/README.md).

## Clients

Two libraries call models. Both use the same gateway and keys.

- **OpenAI SDK:** `createOpenAIClient` in `apps/server/src/lib/openaiClient.ts`.
  The Bottle and Entity classifiers and the About writer run on the OpenAI
  Agents library through this client.
- **AI SDK:** `createLanguageModel` and `createDecisionModel` in
  `apps/server/src/lib/aiSdkModels.ts`. Use these for new single model calls.

A decision model answers typed questions about the same input: yes or no, pick
one, or a score on a scale. It returns probabilities, not text. Ask with
`experimental_decide` from `ai`. `DECISION_MODEL` picks the model and defaults
to TypeSafe AI's Jev. Jev reads text only and rejects images. The `decide` API
is experimental, so check its contract when you upgrade `ai`.

## AI SDK Settings

- Set reasoning effort with the top-level `reasoning` option, such as
  `reasoning: config.OPENAI_REASONING_EFFORT`. The AI SDK passes it to any
  provider that supports it.
- Put settings for one provider under `providerOptions.<provider>`. Send
  `providerOptions: { openai: { store: false } }` so OpenAI does not keep the
  response.
- Put gateway settings under `providerOptions.gateway`. Anthropic models read
  from the prompt cache only with `caching: "auto"`.
- AI SDK calls retry twice by default. Set `maxRetries: 0` when the caller
  retries on its own or a person is waiting, as in photo lookup.

## Errors

`isModelServiceUnavailable` in `openaiClient.ts` owns the retry rule for both
libraries. A spent budget (402), timeout (408), rate limit (429), outage (5xx),
or lost connection is temporary, so the caller waits and retries. Anything else
is a bug and goes to the error handler. See
[Error Handling](../policies/error-handling.md).

Every AI SDK call we make fails with a gateway error that carries an HTTP
status, and the rule reads that status. Gateway error class names do not match
the cause: Jev's rejection of an image arrives as an internal server error with
status 400. A failure that never got a response, such as a dropped connection,
arrives as status 500, so it counts as temporary.

## Tracing

- Sentry traces every OpenAI SDK and AI SDK call on its own, and records the
  complete input and output.
- Some content must stay out of Sentry, such as uploaded photos and full
  review text (see [Sensitive Data](../policies/sensitive-data.md)).
  - For an AI SDK call, set `recordInputs` and `recordOutputs` to `false` in
    its `telemetry` option. Sentry still records the call, its model, and token
    counts. Review clips do this.
  - For an OpenAI SDK call, run the call inside `Sentry.suppressTracing` and
    record a span with no content around it. Photo lookup does this.
- Wrap all the calls in one run with `withSentryConversation` so they share a
  conversation ID.
