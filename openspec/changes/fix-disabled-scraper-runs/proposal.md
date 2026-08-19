## Why

The admin action can queue a scraper run whose code-owned traffic target is disabled. The worker then misreports the local denial as unavailable robots rules and silently defers the run without making a request.

## What Changes

- Reject manual and scheduled runs before creating durable work when a required scraper target is disabled.
- Recheck target enablement in the worker so already-queued runs fail before adapter or network execution.
- Preserve permanent request-policy failures during robots evaluation instead of converting them to transient robots failures.
- Disable the admin run action and explain the disabled or unsynchronized target state.

## Capabilities

### New Capabilities

- `scraper-run-availability`: Defines when scraper runs can be admitted or executed and how the admin action presents unavailable runtime state.

### Modified Capabilities

None.

## Impact

- Changes scraper lifecycle admission, worker execution, and robots error translation.
- Changes the administrator scraper detail action.
- Adds focused server and web regression coverage without changing storage schemas or traffic policy configuration.
