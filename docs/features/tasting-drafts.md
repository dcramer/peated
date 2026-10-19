# Tasting Drafts

A tasting draft lets a member log a dram quickly, even offline, with a photo,
a few words about the bottle, or both. They finish it later, from any device,
and post it as a normal tasting.

Code, runtime schemas, and tests own the exact request and response shapes.
Tracking issue: [dcramer/peated#1380](https://github.com/dcramer/peated/issues/1380).

## What a draft is

A draft is a tasting that has not been posted. It lives in its own
`tasting_draft` table, not in `tasting`, so feeds, Bottle stats, badges, and
profiles never see it. Posting creates the tasting at that moment, which is
why a tasting's `createdAt` is always its post time (see
[Ratings](../architecture/ratings.md#tasting-times)).

A draft has:

- an ID, a UUID chosen by the client, so a device can save before it talks to
  the server;
- `tastedAt`, when the member had the dram (required);
- an optional bottle hint, free text written before a Bottle is chosen;
- an optional Bottle;
- an optional photo; and
- the same tasting details a tasting has: notes, rating band, tags, serving
  style, color, and friends.

Drafts have no flight and no automatic expiry.

## Ownership

Only the member who saved a draft can read, change, publish, or delete it.
Reading, deleting, or publishing another member's draft returns not found.
Saving with an ID that belongs to another member's draft returns
`409 CONFLICT`.

Account deletion deletes the member's drafts and their photos, and removes the
member from friend tags on other members' drafts. See
[Account Access](../architecture/account-access.md#what-deletion-does).

A Bottle merge moves drafts to the surviving Bottle. Deleting a Bottle clears
a draft's Bottle.

## Saving

`PUT /tasting-drafts/{draft}` creates or replaces a draft. The latest save
wins. Every field is replaced, and an omitted field is cleared, except the
photo (see below).

- Tags and friends are checked the same way as for a tasting. A chosen Bottle
  must be active.
- If the member already posted this draft, the save returns `409 CONFLICT`
  with the tasting's ID in `data.tasting`. A stale retry from another device
  cannot bring a posted draft back.
- Saves and publishes for one member run one at a time, so a save that races a
  publish sees the posted tasting.

`GET /tasting-drafts` lists the member's drafts, most recently saved first.
`GET /tasting-drafts/{draft}` returns one draft.

## Photos

The client uploads the photo with `POST /pending-uploads` (purpose
`photo_tasting_entry`) and sends its ID as `pendingImageId`:

- omitted keeps the current photo;
- `null` removes it; and
- an ID replaces it.

The pending upload is the ownership check, as in
[Photo-Assisted Bottle Resolution](./photo-assisted-bottle-resolution.md). The
server copies the photo to `tasting-drafts/`, so it no longer expires with the
pending upload. A replaced or removed photo's file is deleted after the save
commits. A failed file delete is logged and does not fail the save.

## Publishing

`POST /tasting-drafts/{draft}/publish` posts the draft:

1. If the draft is gone, the server returns the member's tasting that was
   posted from it, with no awards. If there is none, it returns not found.
   Clients retry a publish with the same draft ID after a lost response.
2. The draft needs a Bottle. Merged Bottles are resolved, and tags and friends
   are checked again, as `POST /tastings` does.
3. The photo is copied to `tastings/draft-<draft ID>.<ext>` before the
   database work. The path is fixed, so a retry overwrites the same file.
4. In one transaction the server locks the draft, inserts the tasting with the
   draft's `tastedAt`, the draft ID as its `idempotencyKey`, and the photo,
   awards badges, and deletes the draft. A posted tasting always has its photo.
5. After the commit it queues the Bottle stats update, as `POST /tastings`
   does, then deletes the draft's photo file.

The bottle hint is not kept on the tasting. Peated has no use for it after the
member picks a Bottle (see [Sensitive Data](../policies/sensitive-data.md)).

If the draft changes while a publish is running, the publish returns
`409 CONFLICT` and the client can try again.

## Limits

A member can keep at most 1,000 drafts. The cap protects the system from a
runaway client; it is not a product limit. Saving a new draft past the cap
returns `400 BAD_REQUEST`. Existing drafts can still be saved, posted, and
deleted.

## Not yet built

- Identifying the Bottle from the draft's photo in the background, and
  creating a proposed Bottle from a draft.
- The web drafts inbox.

## Ownership in code

- table: `apps/server/src/db/schema/tastingDrafts.ts`
- routes: `apps/server/src/orpc/routes/tastingDrafts/`
- shared tasting insert: `apps/server/src/orpc/routes/tastings/insertTasting.ts`
- photo copy: `apps/server/src/lib/pendingUploads.ts`
