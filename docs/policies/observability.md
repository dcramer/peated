# Observability

## Intent

Telemetry exists for diagnosis and operations. It is not a product behavior
contract and should not change runtime behavior when a sink is unavailable.

## Policy

- Logs describe discrete events and decisions. Spans describe timed work and
  causal relationships. Sentry issues represent actionable unexpected failures,
  not normal control flow. Derive metrics from stable events or spans when
  practical instead of adding duplicate instrumentation.
- Emit stable messages and low-cardinality structured attributes. Put ids and
  occurrence-specific values in attributes rather than message or operation
  names.
- Use OpenTelemetry semantic attributes when one exists. Keep operation names
  provider-neutral, stable, and low-cardinality.
- Bind useful correlation context at the owning boundary: request, user,
  Bottle, tasting, job, agent conversation, or run ids as applicable.
- Async logging context is not durable runtime context. Queues, callbacks, and
  resumed work must carry authoritative identity and correlation explicitly.
- Capture an error once at the boundary that owns the failure. Lower-level
  helpers should return or throw errors instead of reporting the same failure
  independently.
- Use `logError` only when a Sentry issue is warranted. Use structured telemetry
  levels for expected degradation, retries, rejected inputs, and operational
  state that should not create an issue.
- A retry may record attempts, but only the owning boundary should report the
  terminal failure.
- Logging and tracing entry-point modules must state their ownership and error
  semantics in a module comment. Shared logging APIs must make it clear whether
  a call emits diagnostic telemetry or creates an actionable Sentry issue.
- Tool spans may attach bounded arguments and results when the tool contract
  contains public catalog or source evidence and excludes private user data and
  credentials. Use an explicit safe projection for mixed-sensitivity payloads.
- Follow [data-redaction.md](data-redaction.md). Telemetry records safe metadata,
  not private content, credentials, or unrestricted payloads.
- Product tests should assert user-visible or durable outcomes instead of logs,
  spans, or Sentry calls. Instrumentation tests may assert a minimal stable
  signal and its critical safe attributes.

## Exceptions

- A test whose subject is the logging or tracing adapter may assert provider
  behavior directly.
- Process-level crash handlers may capture an error before exit when they also
  flush the telemetry sink.
