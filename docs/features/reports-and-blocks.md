# Reports And Blocks

Members can report content or other members, and block members they do not
want to hear from. Moderators act on reports. Routes, schemas, and tests
define exact behavior.

## Reports

`POST /reports` records a report about member content (a tasting, a member
review, a comment, or a member) or a catalog record a member may have added
(a bottle, an entity, a series, or a flight). It needs a signed-in member who
has accepted the terms, a reason from a short fixed list, and an optional
note. Each member can send 20 reports per hour.

- Reasons cover abuse (spam, harassment, hate, sexual content, violence),
  wrong or made-up information, and "something else". A member must choose a
  reason, and "something else" needs details.
- A report about member content always names the member responsible, so a
  closed report still says who it was about after the content is gone.
- A report about a catalog record names the member who created it when there
  is one. A record added by a scraper or by Peated names no member, and the
  report is titled by the record's current name instead.
- Reports never store the reported content. Moderators follow the link to the
  live content instead. A report about a bottle, entity, or series that was
  later merged follows the merge to the record that lives on.
- Flights are reported by their public ID. Everything else uses its numeric ID.
- Every new report emails each active, verified moderator and administrator,
  except the member who sent it. The email links to the Inbox task. Repeat
  reports about an open target send no email. Reporters are not told the
  outcome.
- A member cannot report their own content, or content that is missing or
  already removed.
- One open report per member and target. Sending the same report again while
  the first is open returns the first one unchanged.

On the web, "Report …" lives in the actions menu (the three-dot button) on
tasting, review, bottle, entity, series, and flight pages, on each comment,
and on a member's profile. It appears only for signed-in members viewing
something they did not create.

Open reports appear in the Moderation Inbox as `report` tasks in the
`community` category, oldest first. Moderators act on a report through the
existing operations, then close it:

- Remove a tasting or member review with the admin content moderation route.
- Delete a comment with the comment delete route.
- Fix, merge, or delete a bottle, entity, series, or flight with the catalog
  tools. The report task links to the record's edit, merge, and history
  pages. The member it names only created the record and may not have written
  the reported text, so the task offers no one-click suspension for catalog
  reports.
- Suspend the member (see Account Access) when the report names one.
- Close the report as `resolved` when action was taken or `dismissed` when no
  action was needed, with an optional note. Closing one report closes every
  open report about the same target with the same outcome.

Reports also close on their own, as `resolved` with a note saying why, when
the target goes away: a tasting or review is removed, a comment is deleted, a
bottle, entity, series, or flight is deleted, the reported member is
suspended, or the reported member deletes their account. The Inbox never
holds a report about something moderators can no longer act on.

Closed reports appear in Moderation History with the outcome, the moderator,
and the note. A report the system closed shows no moderator.

App Store Review Guideline 1.2 requires reporting, blocking, and acting on
reports. Reports should be handled within 24 hours.

## Blocks

`POST /users/{user}/block` and `DELETE /users/{user}/block` add and remove a
block. `GET /users/{user}/blocks` lists a member's own blocks. Blocking needs
only a signed-in member, so a member who has not accepted the terms can still
block.

A block stops interaction. It does not hide content.

- Any friendship or pending friend request between the two members ends.
- Neither member can comment on or toast the other's tastings, or send the
  other a friend request. The rule applies in both directions while either
  member's block stands.
- Both members can still see each other's public content and profiles.
- `blocked` on a serialized user tells the signed-in viewer whether they have
  blocked that member.

Account deletion removes the member's blocks in both directions.

## Who Can Moderate

Moderators and administrators can read reports, close them, remove tastings
and member reviews, delete comments, suspend members, and use the Moderation
workspace. Administrators alone grant roles, suspend moderators, and cannot be
suspended themselves. Moderators see only the Moderation and Content sections
of the admin area.

## Ownership

- schema: `apps/server/src/db/schema/reports.ts` and
  `apps/server/src/db/schema/userBlocks.ts`
- report routes: `apps/server/src/orpc/routes/reports/` and
  `apps/server/src/orpc/routes/admin/reports/`
- report alert: the `NotifyReport` job in `apps/server/src/worker/jobs/` and
  `sendReportEmail` in `apps/server/src/lib/email.ts`
- auto-close: `closeOpenReportsForTarget` and `closeOpenReportsAboutMember`
  in `apps/server/src/lib/reports.ts`, called by the removal, delete,
  suspension, and account deletion paths
- block routes: `apps/server/src/orpc/routes/users/block-*.ts`
- block check: `apps/server/src/lib/userBlocks.ts`, used by the comment, toast,
  and friend request routes
- inbox and history projection: `apps/server/src/lib/moderationTasks.ts` and
  `apps/server/src/lib/moderationHistory.ts`
- web: the report dialog and Inbox report task under
  `apps/web/src/components/`, the settings blocked-members page, and the
  "Report …" menu items in each page's actions under `apps/web/src/app/`
