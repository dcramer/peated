## 1. Resolver Behavior

- [x] 1.1 Remove the `generateBottleCheck` resolver option and always persist the linked check after a completed full classification.
- [x] 1.2 Remove the obsolete option from background-job and retry callers.
- [x] 1.3 Commit the proposal, attempt, and linked check atomically before automation.

## 2. Verification and Documentation

- [x] 2.1 Update targeted store-price tests to prove default check persistence, atomic failure behavior, ignored results, and the new retry job contract.
- [x] 2.2 Update store-price matching documentation to describe unconditional linked-check persistence for full classifier runs.
- [x] 2.3 Run OpenSpec validation, targeted tests, lint, formatting, and server typechecking.
