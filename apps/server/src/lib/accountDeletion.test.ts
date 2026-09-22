import { app } from "@peated/server/app";
import { db } from "@peated/server/db";
import {
  actors,
  badgeAwards,
  collectionBottles,
  collections,
  comments,
  flights,
  follows,
  identities,
  memberReviews,
  notifications,
  passkeys,
  reports,
  tastingBadgeAwards,
  tastings,
  toasts,
  users,
} from "@peated/server/db/schema";
import {
  ACCOUNT_DELETED_REASON,
  ACCOUNT_DELETION_GRACE_MS,
  DELETED_MEMBER_NAME,
  deleteUserAccount,
  processDueAccountDeletions,
} from "@peated/server/lib/accountDeletion";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray, or } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const HOUR_MS = 60 * 60 * 1000;

const REQUEST_ENV = {
  incoming: {
    socket: {
      remoteAddress: "127.0.0.1",
      remotePort: 12345,
      remoteFamily: "IPv4",
    },
  },
};

async function findUser(id: number) {
  return await db.query.users.findFirst({ where: eq(users.id, id) });
}

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
});

describe("deleteUserAccount", () => {
  test("tombstones the member and removes their personal data", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({
      pictureUrl: "/uploads/avatars/deleted-member.webp",
    });
    const other = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: user.id,
      friends: [other.id],
      imageUrl: "/uploads/tastings/deleted-member.webp",
    });
    const otherTasting = await fixtures.Tasting({
      createdById: other.id,
      friends: [user.id],
      comments: 2,
      toasts: 1,
    });
    const comment = await fixtures.Comment({
      tastingId: otherTasting.id,
      createdById: user.id,
    });
    const otherComment = await fixtures.Comment({
      tastingId: tasting.id,
      createdById: other.id,
    });
    await fixtures.Toast({ tastingId: otherTasting.id, createdById: user.id });
    const flight = await fixtures.Flight({
      createdById: user.id,
      bottles: [bottle.id],
    });
    const flightTasting = await fixtures.Tasting({
      createdById: other.id,
      flightId: flight.id,
    });
    const collection = await fixtures.Collection({ createdById: user.id });
    await db
      .insert(collectionBottles)
      .values({ collectionId: collection.id, bottleId: bottle.id });
    await fixtures.Follow({ fromUserId: user.id, toUserId: other.id });
    await fixtures.Follow({ fromUserId: other.id, toUserId: user.id });
    const award = await fixtures.BadgeAward({ userId: user.id });
    await db
      .insert(tastingBadgeAwards)
      .values({ tastingId: tasting.id, awardId: award.id, level: 1 });
    await db.insert(notifications).values([
      {
        userId: user.id,
        fromUserId: other.id,
        objectId: otherComment.id,
        type: "comment",
        createdAt: new Date(),
      },
      {
        userId: other.id,
        fromUserId: null,
        objectId: comment.id,
        type: "comment",
        createdAt: new Date(),
      },
    ]);
    await db.insert(identities).values({
      provider: "google",
      externalId: "google-deleted-member",
      userId: user.id,
    });
    await fixtures.Passkey({ userId: user.id });
    const [review] = await db
      .insert(memberReviews)
      .values({ bottleId: bottle.id, createdById: user.id, score: 80 })
      .returning();

    expect(await deleteUserAccount(user)).toBe(true);

    const deleted = await findUser(user.id);
    expect(deleted).toMatchObject({
      username: `deleted-${user.id}`,
      email: `deleted-${user.id}@peated.invalid`,
      passwordHash: null,
      pictureUrl: null,
      active: false,
      private: true,
      verified: false,
    });
    expect(deleted?.deletedAt).toBeInstanceOf(Date);

    const [actor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.type, "user"), eq(actors.key, String(user.id))));
    expect(actor).toMatchObject({
      displayName: DELETED_MEMBER_NAME,
      pictureUrl: null,
      active: false,
    });

    // Tastings and reviews stay as removed rows.
    const removedTasting = await db.query.tastings.findFirst({
      where: eq(tastings.id, tasting.id),
    });
    expect(removedTasting).toMatchObject({
      createdById: user.id,
      imageUrl: null,
      removedByActorId: actor.id,
      removalReason: ACCOUNT_DELETED_REASON,
    });
    expect(removedTasting?.removedAt).toBeInstanceOf(Date);
    const removedReview = await db.query.memberReviews.findFirst({
      where: eq(memberReviews.id, review.id),
    });
    expect(removedReview).toMatchObject({
      removedByActorId: actor.id,
      removalReason: ACCOUNT_DELETED_REASON,
    });
    expect(removedReview?.removedAt).toBeInstanceOf(Date);

    // Other members keep their records without the deleted member.
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, otherTasting.id),
      }),
    ).toMatchObject({ comments: 1, toasts: 0, friends: [], removedAt: null });
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, flightTasting.id),
      }),
    ).toMatchObject({ flightId: null, removedAt: null });
    expect(
      await db.query.comments.findFirst({
        where: eq(comments.id, otherComment.id),
      }),
    ).toBeDefined();
    expect(await findUser(other.id)).toMatchObject({ deletedAt: null });

    // Everything else the member owned is gone.
    expect(
      await db.select().from(comments).where(eq(comments.createdById, user.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(toasts).where(eq(toasts.createdById, user.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(flights).where(eq(flights.createdById, user.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(collections)
        .where(eq(collections.createdById, user.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(follows)
        .where(
          or(eq(follows.fromUserId, user.id), eq(follows.toUserId, user.id)),
        ),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(badgeAwards)
        .where(eq(badgeAwards.userId, user.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(notifications)
        .where(inArray(notifications.userId, [user.id, other.id])),
    ).toHaveLength(0);
    expect(
      await db.select().from(identities).where(eq(identities.userId, user.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(passkeys).where(eq(passkeys.userId, user.id)),
    ).toHaveLength(0);

    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      expect.objectContaining({ delay: 5000 }),
    );
  });

  test("closes reports about the member and their content, not their catalog records", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const reporter = await fixtures.User();
    const actor = await getUserActorForDatabase(db, user);
    const tasting = await fixtures.Tasting({ createdById: user.id });
    const bottle = await fixtures.Bottle({ createdByActorId: actor.id });
    const [memberReport, tastingReport, bottleReport] = await Promise.all([
      routerClient.reports.create(
        { objectType: "user", objectId: user.id, reason: "spam" },
        { context: { user: reporter } },
      ),
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "spam" },
        { context: { user: reporter } },
      ),
      routerClient.reports.create(
        { objectType: "bottle", objectId: bottle.id, reason: "inaccurate" },
        { context: { user: reporter } },
      ),
    ]);

    expect(await deleteUserAccount(user)).toBe(true);

    const rows = await db
      .select({
        id: reports.id,
        status: reports.status,
        note: reports.closeNote,
      })
      .from(reports)
      .where(
        inArray(reports.id, [
          memberReport.id,
          tastingReport.id,
          bottleReport.id,
        ]),
      );
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(memberReport.id)).toMatchObject({
      status: "resolved",
      note: "Member deleted their account.",
    });
    expect(byId.get(tastingReport.id)?.status).toBe("resolved");
    expect(byId.get(bottleReport.id)?.status).toBe("open");
  });

  test("stops access tokens and hides the profile", async ({ fixtures }) => {
    const user = await fixtures.User();
    const token = await fixtures.AuthToken({ user });

    await deleteUserAccount(user);

    const response = await app.request(
      "/v1/auth/me",
      { headers: { Authorization: `Bearer ${token}` } },
      REQUEST_ENV,
    );
    expect(response.status).toBe(401);

    const err = await waitError(() =>
      routerClient.users.details({ user: user.id }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User not found]`);
  });

  test("keeps the anonymized actor when it is resolved again", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    await deleteUserAccount(user);
    const tombstone = (await findUser(user.id))!;

    const actor = await getUserActorForDatabase(db, tombstone);

    expect(actor).toMatchObject({
      displayName: DELETED_MEMBER_NAME,
      active: false,
    });
  });

  test("does nothing for an already deleted account", async ({ fixtures }) => {
    const user = await fixtures.User();

    expect(await deleteUserAccount(user)).toBe(true);
    expect(await deleteUserAccount(user)).toBe(false);
  });

  test("respects the request cutoff under the lock", async ({ fixtures }) => {
    const cutoff = new Date();
    const canceled = await fixtures.User({ deletionRequestedAt: null });
    const recent = await fixtures.User({
      deletionRequestedAt: new Date(cutoff.getTime() + HOUR_MS),
    });

    expect(await deleteUserAccount(canceled, { requestedBefore: cutoff })).toBe(
      false,
    );
    expect(await deleteUserAccount(recent, { requestedBefore: cutoff })).toBe(
      false,
    );
    expect(await findUser(canceled.id)).toMatchObject({ active: true });
    expect(await findUser(recent.id)).toMatchObject({ active: true });
  });
});

describe("processDueAccountDeletions", () => {
  test("deletes accounts whose grace period has ended", async ({
    fixtures,
  }) => {
    const now = new Date();
    const due = await fixtures.User({
      deletionRequestedAt: new Date(
        now.getTime() - ACCOUNT_DELETION_GRACE_MS - HOUR_MS,
      ),
    });
    const pending = await fixtures.User({
      deletionRequestedAt: new Date(now.getTime() - HOUR_MS),
    });
    const canceled = await fixtures.User({ deletionRequestedAt: null });
    const alreadyDeleted = await fixtures.User({
      deletionRequestedAt: new Date(
        now.getTime() - ACCOUNT_DELETION_GRACE_MS - HOUR_MS,
      ),
      deletedAt: now,
      active: false,
    });

    expect(await processDueAccountDeletions({ now })).toBe(1);

    expect(await findUser(due.id)).toMatchObject({
      active: false,
      username: `deleted-${due.id}`,
    });
    expect(await findUser(pending.id)).toMatchObject({
      active: true,
      username: pending.username,
    });
    expect(await findUser(canceled.id)).toMatchObject({ active: true });
    expect(await findUser(alreadyDeleted.id)).toMatchObject({
      username: alreadyDeleted.username,
    });

    expect(await processDueAccountDeletions({ now })).toBe(0);
  });

  test("continues past an account that fails to delete", async ({
    fixtures,
  }) => {
    const now = new Date();
    const requestedAt = new Date(
      now.getTime() - ACCOUNT_DELETION_GRACE_MS - HOUR_MS,
    );
    const blocked = await fixtures.User({ deletionRequestedAt: requestedAt });
    // Someone already holds the tombstone username, so this row cannot change.
    await fixtures.User({ username: `deleted-${blocked.id}` });
    const due = await fixtures.User({
      deletionRequestedAt: new Date(requestedAt.getTime() + 1000),
    });

    expect(await processDueAccountDeletions({ now })).toBe(1);

    expect(await findUser(blocked.id)).toMatchObject({ active: true });
    expect(await findUser(due.id)).toMatchObject({ active: false });
  });
});
