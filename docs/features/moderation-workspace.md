# Moderation Workspace

Only administrators can use Moderation. It has three sections:

- **Inbox** shows decisions waiting for a person.
- **History** shows finished decisions.
- **Automation** shows work in progress, failures, and retries.

The workspace reads each item from the feature that owns it. It does not copy
those records into a second task system.

## Inbox

The Inbox includes open store-price proposals, Bottle or Entity changes waiting
for review, and unresolved findings. Work that is still running, failed, stale,
or waiting to retry belongs in Automation until it needs a person to decide.

Each selected item asks one question. Keep warnings, changed fields, impact, and
needed evidence visible. Put extra system details behind a disclosure. `Skip`
only moves to another item; it does not change saved state. A failed save keeps
the item and the moderator's input visible.

Desktop can show the list and selected item together. Mobile uses separate list
and detail views with a clear route back to the same filtered list.

## History And Automation

History combines completed listing decisions, reviewed catalog changes, and
closed checks. Show only facts recorded by those sources. Label a missing actor
or reason as unavailable.

Automation shows queue counts, active listing checks, retry runs, and catalog
changes being applied. It is not a model-quality dashboard and cannot approve a
catalog change.
