# Error Handling

## Intent

Let unexpected failures reach the code responsible for reporting or retrying
them. Local catch-and-log blocks can hide failures and create duplicate reports.

## Policy

- Let operations that should succeed throw to the caller. Do not catch only to
  log a warning and continue.
- Catch errors only when the current layer can recover, turn an expected failure
  into a declared domain error or result, or add cleanup that cannot use
  `finally`.
- If a catch block handles an error, it must either finish the recovery or
  rethrow with useful domain context and preserve the original `cause`. Avoid
  log-and-rethrow duplicates.
- Use `finally` for cleanup that must run without changing error ownership.
- Name best-effort behavior in its contract. If correctness depends on the
  operation, it is not best-effort.

## Exceptions

- External systems with expected transient failures may catch at the boundary
  that owns retry, backoff, authentication pause, or typed fallback behavior.
- Product surfaces that intentionally degrade, such as optional UI streaming or
  non-critical observer callbacks, may catch locally when dropping the failure
  is part of their contract.
