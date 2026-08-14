## Why

Peated's moderator work is split across a dashboard, incoming-listing cards, audits, decision logs, and operational controls. The current UI exposes each subsystem's machinery before the human question, making routine decisions slow and difficult to learn as classification and catalog workflows grow.

## What Changes

- Replace the Review Workbench landing page and separate review-flow navigation with one moderator-facing `Moderation` product containing Inbox, History, and Automation destinations.
- Aggregate every unresolved human decision into one compact Inbox while preserving listing, catalog, and audit ownership behind task-specific detail renderers and actions.
- Present one focused task at a time with the human question, source context, recommended outcome, one primary action, clear alternatives, and progressive disclosure for evidence and technical details.
- Advance after successful disposition and allow moderators to skip open work without mutating it.
- Move completed moderator and automated decisions into searchable History with actor, outcome, affected resources, evidence, and activity context.
- Move queue health, classification failures, retries, stale work, and run progress into Automation; operational failures appear in the Inbox only when a catalog decision is required.
- Replace model confidence, automation scores, retry controls, worker health, and structured exports in the default decision view with human-readable evidence and impact summaries.
- Provide URL-backed task details, filter-preserving navigation, keyboard and focus behavior, and responsive list-to-detail navigation for mobile.
- Remove the superseded moderator page and read-API routes after the replacement reaches parity; remaining producers link directly to Moderation.

## Capabilities

### New Capabilities

- `moderation-workspace`: Defines the unified moderator Inbox, focused task review, completed-decision History, operational Automation surface, navigation, responsive behavior, and ownership boundaries.

### Modified Capabilities

None.

## Impact

- Adds administrator-only moderation summary and history read contracts in `apps/server/src/orpc/routes/admin/` while retaining source-owned listing and audit mutations.
- Replaces the current admin landing, Incoming Listings, Audits, Decision Log, queue-health presentation, and review-flow navigation in `apps/web` with nested Moderation routes and shared task-shell components.
- Reuses existing Bottle selectors, Bottle identity presentation, audit operation diffs, rejection reasons, retry routes, and decision logs where their contracts already fit.
- Requires focused server integration tests, deterministic component tests, and desktop and mobile browser coverage for inbox navigation and each task disposition.
- Does not change classifier prompts, automation thresholds, canonical catalog mutation services, or moderator permissions.
