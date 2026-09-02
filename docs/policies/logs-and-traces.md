# Logs And Traces

## Intent

Logs, traces, and Sentry reports help diagnose and operate Peated. They must not
change product behavior when the reporting service is unavailable.

## Policy

- Logs describe events and decisions. Spans describe timed work and causal
  relationships. Sentry issues represent unexpected failures that need action,
  not normal control flow.
- Keep message and operation names stable. Put IDs and values that change on
  each run in structured fields.
- Use standard OpenTelemetry field names when one exists. Do not put a provider
  name in a general operation name.
- Add the IDs needed to connect work at the boundary that owns it.
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
- Follow [sensitive-data.md](sensitive-data.md). Telemetry records safe metadata,
  not private content, credentials, or unrestricted payloads.

## Exceptions

- A test whose subject is the logging or tracing adapter may assert provider
  behavior directly.
- Process-level crash handlers may capture an error before exit when they also
  flush the telemetry sink.
