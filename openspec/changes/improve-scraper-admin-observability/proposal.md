## Why

Peated records scraper lifecycle and traffic telemetry, but administrators cannot see enough of it to tell whether a source is running responsibly or producing useful catalog data. The current site inventory also counts only price listings, which makes review sources appear empty.

## What Changes

- Present the existing external-sites administration as a scraper operations surface.
- Report review and price inventory separately so each source's output is represented accurately.
- Expose existing per-run request, retry, rate-limit, emitted-item, and deferral telemetry in recent run history.
- Show factual runtime and review-source policy state that explains whether a source can run.
- Add catalog matching coverage to the admin scraper overview using the existing coverage definitions.
- Keep traffic policy and source registration code-owned; this change is observational except for the existing manual-run action.

## Capabilities

### New Capabilities

- `scraper-admin-observability`: Administrators can inspect scraper execution, responsible-request behavior, source output, policy state, and catalog matching coverage from one operational surface.

### Modified Capabilities

None.

## Impact

- Extends administrator-only external-site health and run API contracts.
- Adds read-only queries over existing scraper, policy, review, price, and coverage state.
- Updates the existing admin sites list, detail layout, and run history UI.
- Does not add database tables, mutable traffic controls, or a separate monitoring service.
