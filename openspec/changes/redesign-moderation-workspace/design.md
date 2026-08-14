## Context

Peated currently exposes moderator work through several surfaces that mirror implementation boundaries:

- `/admin` combines review guidance, listing throughput, backlog aging, and worker health.
- `/admin/queue` renders every actionable store-price proposal as a large card containing the source, current assignment, extracted identity, candidates, recommendation, evidence, automation assessment, retry state, and all actions.
- `/admin/audits` lists Bottle checks, then reviews every operation and finding for one check together.
- `/admin/incoming-decisions` shows only incoming-listing decision history.
- Queue health and retry runs appear beside human decisions even when they do not change the decision.

The underlying ownership boundaries are sound and must remain explicit. Store-price proposals own listing assignment. Bottle checks and Review Operations own catalog advice and approval. Canonical Bottle and Entity services own mutations. BullMQ and retry-run records own operational execution. The redesign changes discovery and presentation, not those mutation boundaries.

The design targets administrators because the existing moderator workbench routes require administrator authority. It does not broaden access to moderators who lack that authority.

### Design references

The mockups establish hierarchy and visual direction. This document and the capability spec are authoritative when a mockup contains exploratory behavior.

- [Listing decision](mockups/inbox-listing-decision.png)
- [Catalog field change](mockups/inbox-catalog-change.png)
- [Blocked listing](mockups/inbox-blocked-listing.png)
- [Decision history](mockups/history-decision.png)
- [Automation health](mockups/automation-health.png)
- [Mobile inbox and decision](mockups/mobile-inbox-and-decision.png)

The mockups show both `Skip` and `Next task` before disposition. The accepted interaction uses only `Skip` while work remains open. A successful disposition advances automatically; a completed detail may offer `Next task` if automatic navigation cannot occur.

## Goals / Non-Goals

**Goals:**

- Give moderators one place to find every outstanding human decision.
- Reduce each task to one domain question and one obvious primary action.
- Keep evidence, impact, and alternative actions available without making classifier and queue internals prerequisite knowledge.
- Separate pending decisions, completed history, and operational recovery.
- Preserve source-owned authorization, validation, locking, transactions, and side effects.
- Keep task URLs shareable and preserve inbox filters and position during review.
- Provide equivalent desktop and mobile workflows with accessible focus and status behavior.
- Replace the current workbench after capability parity without retaining two permanent moderation experiences.

**Non-Goals:**

- Changing classifier prompts, evidence policy, automation thresholds, or Bottle identity rules.
- Adding a generic moderation table, generic action endpoint, workflow engine, assignment, claiming, snoozing, or escalation.
- Changing canonical Bottle, Entity, merge, or listing-resolution mutations.
- Making worker failures silently recover or adding new retry policies.
- Rebuilding ordinary admin catalog and configuration tools.
- Preserving the visual structure or terminology of the current queue and audit pages.

## Decisions

### 1. Organize the product around Inbox, History, and Automation

`Moderation` becomes the parent admin destination:

```text
/admin/moderation/inbox
/admin/moderation/inbox/[kind]/[taskId]
/admin/moderation/history
/admin/moderation/history/[kind]/[eventId]
/admin/moderation/automation
```

The Inbox contains unresolved human decisions. History contains terminal human and automated decisions. Automation contains processing, failure, retry, and run state whose next action is operational. Ordinary Admin tools remain a separate navigation section.

This boundary answers one question for each destination and removes the current dashboard as an intermediate start page. A single page containing all three concerns was rejected because it recreates the workbench's competing priorities.

### 2. Project existing records into tasks instead of adding task storage

The server exposes a small administrator-only moderation task projection. It does not persist another lifecycle:

| Task key                  | Source                               | Human decision                                        |
| ------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `listing:<proposalId>`    | Store-price match proposal           | Assign, create, repair, or ignore one listing         |
| `operation:<operationId>` | Review Operation                     | Apply included changes or remove one Suggested Change |
| `finding:<checkId>`       | Bottle check with remaining findings | Close or manually resolve the remaining findings      |

Each list item is a strict discriminated projection with a stable key, kind, category, title, source label, attention timestamp, and human-readable state. Detail data continues to come from the existing source detail route. The projection does not return arbitrary metadata or embed the current full queue/audit payload.

One task represents one decision. An audit with three Review Operations therefore contributes three operation tasks, not one compound audit card. A finding disposition appears only after separately reviewable operations no longer need a decision.

A new durable task table was rejected because the source records already own lifecycle and idempotency. Duplicating their state would create reconciliation and permission problems without proving a need for assignment or scheduling.

### 3. Keep all mutations at their existing owners

Moderation adds read models for cross-source discovery, history, and operational summaries. It does not add `resolveTask` or another generic mutation.

- Listing tasks call the existing match, create-Bottle, apply-repair, choose-Bottle, ignore, and retry capabilities.
- Operation tasks call the existing approve, reject, and retry Review Operation capabilities.
- Finding tasks call the existing audit close capability or link to canonical manual editing.
- Automation recovery calls the existing retry-run, cancellation, reconciliation, or source-specific retry capability.

The UI chooses a task renderer from the task kind, and each renderer imports only its source-owned actions. This keeps actor checks, state tokens, locks, and canonical side effects at the current runtime boundaries.

A configurable generic renderer/action registry was rejected. Three explicit renderers are smaller, safer, and easier for maintainers to understand.

### 4. Define Inbox membership by the next required action

A record belongs in the Inbox when an authorized human can make a domain disposition now:

- select, create, repair, or ignore a listing assignment;
- approve or remove a Suggested Change;
- disposition remaining findings or unsupported historical work.

Processing leases, batch progress, approved operations waiting to execute, and failures whose only valid next step is operational recovery belong in Automation. A mechanically blocked Suggested Change remains in the Inbox when a moderator must remove it, resolve it manually, or close its findings.

This rule is intentionally based on the next action rather than source status names. It prevents `errored`, `failed`, `blocked`, and `stale` from being mapped mechanically when their ownership differs.

### 5. Use one persistent review shell with explicit task renderers

Desktop uses a three-column admin layout: global navigation, compact inbox list, and selected task detail. The task detail always presents:

1. one human question;
2. source and subject context;
3. recommended outcome or blocking explanation;
4. one primary action;
5. valid alternatives;
6. evidence and system details under disclosure;
7. an impact statement for irreversible or broad mutations.

Listing task variants cover `match_existing`, `create_new`, `correction`, and `no_match`. Review Operation variants reuse the live field diff, merge preview, impact counts, warnings, field exclusion, and structured rejection reasons. Finding tasks reuse close reasons and manual-edit links.

The current large queue card and audit-wide reviewer are not wrapped inside the shell. Their useful domain components are extracted or reused, while the task composition is rewritten around the question.

### 6. Make disposition and navigation unambiguous

Before disposition, `Skip` navigates to the next task without changing the current task. There is no simultaneous `Next` action with the same effect.

After a successful terminal disposition, the client invalidates the relevant source detail, moderation inbox, counts, history, and automation projections, then opens the next task in the current filtered order. When no task remains, it shows a completion state with a route back to the full Inbox.

Mutation failure keeps the current task selected, preserves editable input and field exclusions, announces the error at the task action area, and does not advance. Unexpected failures remain owned by the source mutation boundary.

### 7. Use deterministic attention ordering and URL state

The default Inbox order is oldest attention timestamp first, with the stable task key as the tie-breaker. For listings, attention starts when the proposal entered human review. For Suggested Changes and findings, it starts when the check completed or the operation became reviewable.

Search, category, and blocked filters live in the URL. Task detail routes remain nested under the Inbox layout so list data, scroll position, and filters persist during selection. Direct task URLs load the same shell and return a not-found or no-longer-actionable state when the source has become terminal.

Synthetic risk scoring and a configurable priority engine were rejected. Oldest-first is explainable and avoids another hidden policy.

### 8. Build History as a union of existing durable decisions

History projects existing incoming decision logs, Review Operation reviews/results, and audit closures into strict event summaries. Detail views load the owning source record and synthesize a small activity sequence from its durable timestamps.

History does not copy records into a new event store in this change. It clearly labels unavailable historical context rather than inventing actors, evidence, or outcomes. Filters cover actor type, category, outcome, and date/search where supported by the underlying data.

### 9. Keep Automation operational and bounded

Automation combines the existing queue counts, active listing retry runs, processing proposals, and failed or stale post-decision execution that has an operational recovery action. It shows compact health totals, needs-attention rows, and recent runs.

This surface does not become a general observability dashboard. It exposes only state and actions already required to operate moderator-related work. Classifier quality and rollout reporting remain in the existing CLI/eval reporting boundary.

### 10. Adapt the shell instead of shrinking it on mobile

At desktop widths the Inbox list and task detail are visible together. At mobile widths `/inbox` shows the list and a task route shows a full-screen detail with a back control. Moderation destinations use reachable mobile navigation; Admin tools remain available from the menu. Tables such as field diffs become stacked before/after rows with full-size inclusion controls.

Successful disposition preserves the mobile detail context while loading the next task. Native back navigation returns to the filtered list and its prior scroll position.

### 11. Treat focus, announcements, and disclosure as workflow behavior

Task selection moves focus to the task question on mobile and retains predictable list/detail focus on desktop. Successful disposition and errors use an accessible live message. All actions have explicit labels, all disclosures use native button/summary semantics, and keyboard shortcuts are disabled while focus is in an input, select, or textarea.

Evidence and system details default closed. Warnings, blocking explanations, changed fields, impacted resources, and the primary decision never depend on opening a disclosure.

## Risks / Trade-offs

- **[Cross-source ordering can become an expensive query]** → Return a narrow projection, index the source attention columns already used for review, use a bounded SQL union, and prove pagination/order with integration tests before adding caching.
- **[A projected task can become terminal between list and selection]** → Revalidate at the source detail and mutation boundaries, show a no-longer-actionable state, refresh the Inbox, and never infer that a stale projection is still mutable.
- **[History sources have unequal detail]** → Render only durable facts each owner provides and label missing context; do not introduce guessed compatibility fields.
- **[Progressive disclosure can hide information needed for safety]** → Keep warnings, blocking reasons, changed fields, impact, and evidence sufficiency in the primary view; collapse only supporting evidence and technical metadata.
- **[Moving operational state can make an approved change feel lost]** → Successful approval writes History immediately and links any continuing execution from its history detail to Automation.
- **[A full replacement has broad UI regression risk]** → Land read projections and shell first, migrate one task kind at a time behind route-local composition, and remove superseded routes only after focused desktop/mobile parity checks.
- **[Generated mockups can be mistaken for exact contracts]** → Keep interaction rules in this design and the spec authoritative; use mockups only for hierarchy, density, and visual direction.

## Migration Plan

1. Add and test the strict moderation Inbox, History, and Automation read projections without changing existing mutations or routes.
2. Add the Moderation route shell, navigation, responsive layouts, empty/loading/error states, and list/detail URL behavior.
3. Implement listing task variants and prove match, create, repair, manual selection, ignore, skip, mutation failure, and auto-advance.
4. Implement Review Operation and finding task variants using existing diff, impact, rejection, retry, and close capabilities.
5. Implement History details and Automation recovery using existing durable records and actions.
6. Run focused server tests, web typecheck/lint/tests, and desktop/mobile browser QA for every task kind.
7. Keep `/admin` as the canonical entry redirect, remove `/admin/queue`, `/admin/audits`, `/admin/incoming-decisions`, and their superseded read APIs, then update remaining producers to link directly to Moderation.

Rollback keeps the source records and mutations unchanged: revert the route removal while removing the new read-only projections and shell. No data migration is required.

## Open Questions

None block implementation. Real moderator use after launch should determine whether assignment, saved views, or additional prioritization is justified; none is included speculatively.
