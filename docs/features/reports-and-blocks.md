# Reports And Blocks

Members can report content or other members, and block members they do not
want to hear from. Moderators act on reports. Routes, schemas, and tests
define exact behavior.

## Reports

`POST /reports` records a report about a tasting, a member review, a comment,
or a member. It needs a signed-in member who has accepted the terms, a reason
from a short fixed list, and an optional note. Each member can send 20 reports
per hour.

- A report always names the member responsible for the content, so a closed
  report still says who it was about after the content is gone.
- Reports never store the reported content. Moderators follow the link to the
  live content instead.
- A member cannot report their own content, or content that is missing or
  already removed.
- One open report per member and target. Sending the same report again while
  the first is open returns the first one unchanged.

Open reports appear in the Moderation Inbox as `report` tasks in the
`community` category, oldest first. Moderators act on a report through the
existing operations, then close it:

- Remove a tasting or member review with the admin content moderation route.
- Delete a comment with the comment delete route.
- Suspend the member (see Account Access).
- Close the report as `resolved` when action was taken or `dismissed` when no
  action was needed, with an optional note. Closing one report closes every
  open report about the same target with the same outcome.

Closed reports appear in Moderation History with the outcome, the moderator,
and the note.

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
- block routes: `apps/server/src/orpc/routes/users/block-*.ts`
- block check: `apps/server/src/lib/userBlocks.ts`, used by the comment, toast,
  and friend request routes
- inbox and history projection: `apps/server/src/lib/moderationTasks.ts` and
  `apps/server/src/lib/moderationHistory.ts`
- web: the report dialog, profile actions, settings blocked-members page, and
  the Inbox report task under `apps/web/src/components/`
