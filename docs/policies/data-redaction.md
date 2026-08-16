# Data Redaction

## Intent

Logs, traces, errors, model context, and operational output should contain only
the data needed for their purpose. Redaction is a safety backstop, not a reason
to collect unrestricted user or provider data.

## Policy

- Never record passwords, authentication tokens, session cookies, OAuth codes,
  authorization headers, API keys, signed callbacks, or credential-bearing
  URLs in logs, traces, errors, or attachments.
- Do not record complete tasting text, comments, email bodies, model prompts or
  responses, unrestricted tool payloads, uploaded image contents, SQL parameters
  containing user data, or unrestricted third-party responses.
- Classifier tool telemetry may record bounded arguments and results when they
  contain only public catalog or source evidence. Do not include private user
  data, credentials, uploaded image contents, or unrestricted provider payloads.
- Prefer stable identifiers, operation names, counts, sizes, classifications,
  status values, and bounded error summaries.
- Persist normalized product fields instead of complete provider webhook, SDK,
  or model payloads unless the raw payload is an explicit product requirement
  with defined access and retention.
- Apply allowlists when serializing third-party errors, metadata, Sentry
  contexts, or attachments. Field-name redaction remains a backstop and must not
  be the only protection.
- Include only content authorized and necessary for the active actor and task in
  model or tool context. Retrieved content and tool results must not widen data
  access.
- Missing visibility or ownership context never widens access.

## Verification

- Test deterministic serialization, authorization, and retention boundaries.
- Do not assert raw private content in telemetry snapshots or fixtures.

## Exceptions

- A narrowly scoped administrative or migration tool may inspect raw data when
  access is explicit, output defaults are safe, and the operation is audited.
