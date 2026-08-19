## Context

Scraper target enablement is code-owned and synchronized to SQL. Run admission currently verifies source registration and review-source authorization, but it does not verify target enablement. A worker discovers the disabled target only while acquiring the first request permit. When that first request is a robots refresh, the robots boundary converts the permanent local denial into a transient `robots_unavailable` deferral.

## Goals / Non-Goals

**Goals:**

- Keep disabled-target policy inside the scraper module.
- Refuse new durable work before insertion or queue dispatch.
- Recheck the policy during execution so queued work cannot bypass a later change.
- Make the admin action match the factual runtime state.
- Keep automatic scheduling, run history, and traffic readiness as separate operator concerns.

**Non-Goals:**

- Bypassing Astor Wines' non-browser catalog response.
- Adding runtime-editable scraper policy.
- Adding new logging, cancellation, or database fields.

## Decisions

### Use one typed disabled-target error at scraper boundaries

The definition boundary will validate every target required by a source and raise a typed error containing the target key. Run insertion and worker execution will call the same capability. The API will translate admission failure to a conflict, while worker execution will store the bounded error and fail the run.

Alternative: rely only on the request coordinator. That creates durable work known to be invalid and makes the result depend on which request happens first.

### Preserve permanent request-policy errors during robots refresh

The robots boundary will continue to defer transport and remote failures when it cannot establish fresh rules. It will rethrow an `invalid_request` because that result means the runtime cannot legally issue the request and waiting cannot change it.

Alternative: preflight only target enablement. That fixes the current registry state but leaves synchronization and other permanent request-policy failures mislabeled.

### Derive the admin action from existing health facts

The web client will use the existing registration, synchronized target, target enablement, and review policy fields. It will not add a second API contract or mutable control.

Alternative: return a new server-computed availability field. The existing health response already contains the small set of facts needed by this one component.

### Represent Astor Wines as manual-only

Astor Wines will keep its null schedule so the scheduler never creates work for it. Its traffic target will be enabled so an explicit administrator run can acquire a permit, refresh unknown or expired robots rules, and attempt the catalog. The admin run-status label will describe only recorded runs; schedule and traffic readiness remain separate fields.

Alternative: let manual runs bypass disabled targets. That weakens the code-owned no-network guard and adds a second permit policy when the existing schedule field already represents manual-only operation.

## Risks / Trade-offs

- **A source later treats a declared target as optional** → Current source definitions describe required traffic targets. Introduce optionality only with a proven source requirement.
- **The UI health snapshot becomes stale after a deploy** → The server-side admission check remains authoritative and returns a conflict.
- **An existing queued run is delivered after the change** → Worker execution rechecks enablement and stores a terminal disabled-target error before adapter or network work.
- **Astor still rejects the catalog request** → The manual run reports the remote failure after robots evaluation instead of appearing disabled or waiting on a false robots deferral.
