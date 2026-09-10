# Moderation Workspace

Only administrators can use Moderation. It has three sections:

- **Inbox** shows decisions waiting for a person.
- **History** shows finished decisions.
- **Background work** shows failures and retries. The admin overview shows its
  live totals alongside scraper activity.

The workspace reads each item from the feature that owns it. It does not copy
those records into a second task system.

## Inbox

The Inbox includes open store-price proposals, Bottle or Entity changes waiting
for review, and unresolved findings. Work that is still running, failed, stale,
or waiting to retry belongs in Background work until it needs a person to
decide.

Each selected item asks one question. Keep warnings, changed fields, impact, and
needed evidence visible. Put extra system details behind a disclosure. `Skip`
only moves to another item; it does not change saved state. A failed save keeps
the item and the moderator's input visible.

Desktop can show the list and selected item together. Mobile uses separate list
and detail views with a clear route back to the same filtered list.

## History And Background Work

History combines completed listing decisions, reviewed catalog changes, and
closed checks. Show only facts recorded by those sources. Label a missing actor
or reason as unavailable.

The admin overview shows open Inbox decisions separately from failed and active
background work. It also shows recent price-matching results and the current
Bottle resolution of review and price inputs added in the last 30 days.
Background work shows retry runs and catalog changes that stopped. It is not a
measure of decision accuracy and cannot approve a catalog change.
