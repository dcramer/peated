# Moderation Workspace

Moderators and administrators can use Moderation. The admin sidebar groups
these pages under Moderation:

- **Inbox** shows decisions waiting for a person.
- **Reports** lists every member report by status: open, resolved, or
  dismissed. An open row opens its Inbox task; a closed row opens its History
  entry. Decisions happen in the Inbox, not here.
- **History** shows finished decisions.
- **Reviews** and **Tastings** list member content so a moderator can read it
  and remove what should not appear on Peated.

**Background work** (`/admin/background-work`) shows failures and retries. It
sits under System in the sidebar because it is about the machinery, not about
decisions, and only administrators see it. The admin overview shows its live
totals alongside scraper activity.

The workspace reads each item from the feature that owns it. It does not copy
those records into a second task system.

## Inbox

The Inbox includes open store-price proposals, Bottle or Entity changes waiting
for review, unresolved findings, and open member reports. Work that is still
running, failed, stale, or waiting to retry belongs in Background work until it
needs a person to decide. A store-price proposal appears only while the store
still shows the listing; see `docs/architecture/store-price-matching.md`.

A catalog task reads its saved Bottle check through
`apps/server/src/lib/bottleCheckEvidence.ts`, which keeps only the IDs, links,
and field names that review needs. A check saved before a classifier schema
change still opens and can be reviewed.

A report task shows who sent the report, who it is about (when a member is
named), the reason, and a link to the live content. Its actions remove the
content, delete the comment, suspend the member, and close the report as
resolved or dismissed. A report about a bottle, entity, series, or flight
links to that record's edit, merge, and history pages instead, and offers no
suspend action. Reports close on their own when their target is removed, so
the Inbox never lists a report about content that is already gone. See
`docs/features/reports-and-blocks.md`.

Each selected item asks one question. Keep warnings, changed fields, impact, and
needed evidence visible. Put extra system details behind a disclosure. `Skip`
only moves to another item; it does not change saved state. A failed save keeps
the item and the moderator's input visible.

Desktop can show the list and selected item together. Mobile uses separate list
and detail views with a clear route back to the same filtered list.

## History And Background Work

History combines completed listing decisions, reviewed catalog changes,
closed checks, and closed reports. Show only facts recorded by those sources. Label a missing actor
or reason as unavailable.

The admin overview shows open Inbox decisions separately from failed and active
background work. It also shows recent price-matching results and the current
Bottle resolution of review and price inputs added in the last 30 days.
Background work shows retry runs, queued jobs, and catalog changes that
stopped. It is not a measure of decision accuracy and cannot approve a catalog
change.

Failed work is recent by definition. A failed queued job or price retry stays in
the failed count and the stopped-work list for three days, then the worker
removes the job and the count drops it. A stopped catalog change stays until its
check is closed. The stopped-work list and the failed count read the same
sources, so the list is never empty while the count is above zero.

The scraper panel on the admin overview lists a source only while its latest
completed collection run failed. One successful run clears it. A run that is
still in progress does not clear it.
