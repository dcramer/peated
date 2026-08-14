# Moderation Workspace

The administrator-only Moderation product is organized around three distinct
jobs:

- **Inbox** projects outstanding human decisions from their owning records.
- **History** projects completed decisions from durable source records.
- **Automation** shows processing, waiting, failures, retry runs, and bounded
  operational recovery.

The workspace does not own a task table or a second workflow lifecycle. Stable
task keys locate the source that owns the decision:

- `listing:<proposalId>` points to a store-price match proposal.
- `operation:<operationId>` points to one independently reviewable Bottle
  operation and its parent check.
- `finding:<checkId>` points to the remaining finding disposition for a Bottle
  check after its independently reviewable operations are resolved.

## Inbox membership

Inbox contains work only when a person must choose an outcome. Actionable
store-price proposals become listing tasks. Each pending or blocked Review
Operation becomes its own catalog task. A check becomes one finding task only
after no independent operation remains.

Processing, applying, stale, and failed execution states belong to Automation
when their next step is wait, retry, cancel, reconcile, or rerun. Recovery that
produces a new proposed catalog change returns that decision to Inbox.

The default order is the oldest attention timestamp first, with the stable task
key as a tie-breaker. Task summaries remain narrow. Full listing and audit data
is loaded from the existing source-owned read routes only after selection.

## Decisions and navigation

One selected task asks one human question. Decision-critical warnings, changed
fields, and impact stay visible; evidence and system metadata use separate,
closed disclosures. `Skip` only navigates and never changes source state. A
successful terminal disposition refreshes Inbox and advances to the next task.
Failed mutations keep the task selected and preserve local input.

Listing decisions continue through `prices.matchQueue` capabilities. Review
Operation approval or removal and finding closure continue through `audits`
capabilities. The Moderation route boundary adds administrator-only read
projections; it does not duplicate those mutation policies.

Desktop shows destination navigation, the compact list, and selected detail at
once. Mobile uses the same URL-backed state as separate list and full-width
detail views, with an explicit route back to the filtered list.

## History and Automation

History unifies incoming decision logs, reviewed Bottle operations, and closed
Bottle checks. It displays only context present on those durable records and
labels missing actors or context as unavailable.

Automation combines factual queue counts with active listing processing, retry
runs, and post-decision Bottle operation execution. It must not become a model
quality dashboard or an alternate place to approve a catalog change.
