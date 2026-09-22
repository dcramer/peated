import { db } from "@peated/server/db";
import {
  actors,
  badgeAwards,
  badgeAwardTrackedObjects,
  bottleObservations,
  collectionBottles,
  collections,
  comments,
  entityFollows,
  externalSiteRuns,
  flightBottles,
  flights,
  follows,
  identities,
  memberReviews,
  notifications,
  oauthAuthorizationCodes,
  passkeys,
  pendingUploads,
  storePriceMatchProposals,
  storePriceMatchRetryRuns,
  tastingBadgeAwards,
  tastings,
  toasts,
  users,
  type User,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { dispatchBottleStatsRecomputes } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { logError } from "@peated/server/lib/log";
import { deleteUploadByUrl } from "@peated/server/lib/uploads";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { AuditEvent, auditLog } from "./auditLog";

/** Display name left on the member's actor row in catalog history. */
export const DELETED_MEMBER_NAME = "Deleted member";
/** Removal reason written on the member's tastings and reviews. */
export const ACCOUNT_DELETED_REASON = "Account deleted";
/** How long a member has to cancel after asking for deletion. */
export const ACCOUNT_DELETION_GRACE_MS = 24 * 60 * 60 * 1000;

/** When a requested deletion will run, or null when none is pending. */
export function getDeletionScheduledAt(
  user: Pick<User, "deletionRequestedAt">,
): Date | null {
  return user.deletionRequestedAt
    ? new Date(user.deletionRequestedAt.getTime() + ACCOUNT_DELETION_GRACE_MS)
    : null;
}

/**
 * Deletes every account whose grace period has ended. Each account is checked
 * again under a row lock, so a cancellation that lands after this read wins.
 * One account's failure is reported and does not stop the others. Returns
 * the number of accounts deleted.
 */
export async function processDueAccountDeletions({
  now = new Date(),
}: { now?: Date } = {}): Promise<number> {
  const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_MS);
  const due = await db
    .select()
    .from(users)
    .where(and(isNull(users.deletedAt), lte(users.deletionRequestedAt, cutoff)))
    .orderBy(asc(users.deletionRequestedAt))
    .limit(100);

  let deleted = 0;
  for (const user of due) {
    try {
      if (await deleteUserAccount(user, { requestedBefore: cutoff })) {
        auditLog({ event: AuditEvent.ACCOUNT_DELETED, userId: user.id });
        deleted += 1;
      }
    } catch (error) {
      logError(error, {
        extra: { userId: user.id, operation: "accountDeletion.process" },
      });
    }
  }
  return deleted;
}

/**
 * Placeholder values for a deleted member's row. Username and email stay
 * unique so the member's old values are free to use again. The `deleted-`
 * username prefix is reserved for this; see `isReservedUsername`.
 */
function deletedUserFields(userId: number, deletedAt: Date) {
  return {
    username: `deleted-${userId}`,
    email: `deleted-${userId}@peated.invalid`,
    passwordHash: null,
    pictureUrl: null,
    verified: false,
    private: true,
    active: false,
    admin: false,
    mod: false,
    notifyComments: false,
    deletedAt,
  } satisfies Partial<User>;
}

/**
 * Deletes a member's account. Returns false when the account was already
 * deleted or no longer meets `requestedBefore`.
 *
 * Catalog contributions stay: Bottles, Entities, and their change history keep
 * the member's actor row with the name and picture removed. The user row stays
 * as a tombstone with its personal fields replaced, and the member's tastings
 * and reviews stay as removed rows, like moderated content. Everything else the
 * member owns (comments, toasts, collections, flights, follows, badges,
 * notifications, uploads, sign-in identities, passkeys, and OAuth grants) is
 * deleted.
 *
 * Stored images are removed after the database commit. That step is
 * best-effort: a storage failure is reported and does not undo the deletion.
 */
export async function deleteUserAccount(
  user: User,
  {
    requestedBefore,
  }: {
    /** Only delete when the request is still open and at least this old. */
    requestedBefore?: Date;
  } = {},
): Promise<boolean> {
  const deletedAt = new Date();

  const result = await db.transaction(async (tx) => {
    const userId = user.id;

    const [locked] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    if (!locked || locked.deletedAt) {
      return null;
    }
    if (
      requestedBefore &&
      (!locked.deletionRequestedAt ||
        locked.deletionRequestedAt > requestedBefore)
    ) {
      return null;
    }

    const actor = await getUserActorForDatabase(tx, locked);

    const ownTastings = tx
      .select({ id: tastings.id })
      .from(tastings)
      .where(eq(tastings.createdById, userId));
    const ownComments = tx
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.createdById, userId));
    const ownToasts = tx
      .select({ id: toasts.id })
      .from(toasts)
      .where(eq(toasts.createdById, userId));
    const ownAwards = tx
      .select({ id: badgeAwards.id })
      .from(badgeAwards)
      .where(eq(badgeAwards.userId, userId));
    const ownCollections = tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.createdById, userId));
    const ownFlights = tx
      .select({ id: flights.id })
      .from(flights)
      .where(eq(flights.createdById, userId));

    // Read what the after-commit steps need before rows change.
    const tastingRows = await tx
      .select({ bottleId: tastings.bottleId, imageUrl: tastings.imageUrl })
      .from(tastings)
      .where(eq(tastings.createdById, userId));
    const reviewRows = await tx
      .select({
        bottleId: memberReviews.bottleId,
        imageUrl: memberReviews.imageUrl,
      })
      .from(memberReviews)
      .where(eq(memberReviews.createdById, userId));
    const collectionRows = await tx
      .select({ imageUrl: collectionBottles.imageUrl })
      .from(collectionBottles)
      .where(inArray(collectionBottles.collectionId, ownCollections));
    const pendingRows = await tx
      .select({ imageUrl: pendingUploads.imageUrl })
      .from(pendingUploads)
      .where(eq(pendingUploads.createdById, userId));

    // Notifications sent to the member, sent by the member, or about the
    // member's comments and toasts.
    await tx
      .delete(notifications)
      .where(
        or(
          eq(notifications.userId, userId),
          eq(notifications.fromUserId, userId),
          and(
            eq(notifications.type, "comment"),
            inArray(notifications.objectId, ownComments),
          ),
          and(
            eq(notifications.type, "toast"),
            inArray(notifications.objectId, ownToasts),
          ),
        ),
      );

    // Comments and toasts the member left on tastings, with their counters.
    await tx.execute(sql`
      UPDATE ${tastings}
      SET comments = GREATEST(${tastings.comments} - removed.total, 0)
      FROM (
        SELECT ${comments.tastingId} AS tasting_id, COUNT(*)::int AS total
        FROM ${comments}
        WHERE ${comments.createdById} = ${userId}
        GROUP BY ${comments.tastingId}
      ) AS removed
      WHERE ${tastings.id} = removed.tasting_id
    `);
    await tx.execute(sql`
      UPDATE ${tastings}
      SET toasts = GREATEST(${tastings.toasts} - removed.total, 0)
      FROM (
        SELECT ${toasts.tastingId} AS tasting_id, COUNT(*)::int AS total
        FROM ${toasts}
        WHERE ${toasts.createdById} = ${userId}
        GROUP BY ${toasts.tastingId}
      ) AS removed
      WHERE ${tastings.id} = removed.tasting_id
    `);
    await tx.delete(comments).where(eq(comments.createdById, userId));
    await tx.delete(toasts).where(eq(toasts.createdById, userId));

    // Tastings and reviews stay as removed rows. Content already removed by a
    // moderator keeps its original removal record.
    const removal = {
      removedAt: deletedAt,
      removedByActorId: actor.id,
      removalReason: ACCOUNT_DELETED_REASON,
    };
    await tx
      .update(tastings)
      .set({ imageUrl: null })
      .where(eq(tastings.createdById, userId));
    await tx
      .update(tastings)
      .set(removal)
      .where(and(eq(tastings.createdById, userId), isNull(tastings.removedAt)));
    await tx
      .update(memberReviews)
      .set({ imageUrl: null })
      .where(eq(memberReviews.createdById, userId));
    await tx
      .update(memberReviews)
      .set(removal)
      .where(
        and(
          eq(memberReviews.createdById, userId),
          isNull(memberReviews.removedAt),
        ),
      );

    await tx
      .delete(tastingBadgeAwards)
      .where(inArray(tastingBadgeAwards.awardId, ownAwards));
    await tx
      .delete(badgeAwardTrackedObjects)
      .where(inArray(badgeAwardTrackedObjects.awardId, ownAwards));
    await tx.delete(badgeAwards).where(eq(badgeAwards.userId, userId));

    // Other members' tastings keep the tasting and lose the flight link.
    await tx
      .update(tastings)
      .set({ flightId: null })
      .where(inArray(tastings.flightId, ownFlights));
    await tx
      .delete(flightBottles)
      .where(inArray(flightBottles.flightId, ownFlights));
    await tx.delete(flights).where(eq(flights.createdById, userId));

    await tx
      .delete(collectionBottles)
      .where(inArray(collectionBottles.collectionId, ownCollections));
    await tx.delete(collections).where(eq(collections.createdById, userId));

    await tx
      .delete(follows)
      .where(or(eq(follows.fromUserId, userId), eq(follows.toUserId, userId)));
    await tx.delete(entityFollows).where(eq(entityFollows.userId, userId));
    await tx
      .delete(pendingUploads)
      .where(eq(pendingUploads.createdById, userId));
    await tx.delete(identities).where(eq(identities.userId, userId));
    await tx.delete(passkeys).where(eq(passkeys.userId, userId));
    await tx
      .delete(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.userId, userId));

    // Friend tags naming the member on other members' records.
    await tx
      .update(tastings)
      .set({
        friends: sql`array_remove(${tastings.friends}, ${userId}::bigint)`,
      })
      .where(sql`${userId}::bigint = ANY(${tastings.friends})`);
    await tx
      .update(memberReviews)
      .set({
        friends: sql`array_remove(${memberReviews.friends}, ${userId}::bigint)`,
      })
      .where(sql`${userId}::bigint = ANY(${memberReviews.friends})`);

    // Staff references without a database rule for a removed member.
    await tx
      .update(bottleObservations)
      .set({ createdById: null })
      .where(eq(bottleObservations.createdById, userId));
    await tx
      .update(storePriceMatchProposals)
      .set({ reviewedById: null })
      .where(eq(storePriceMatchProposals.reviewedById, userId));
    await tx
      .update(storePriceMatchRetryRuns)
      .set({ createdById: null })
      .where(eq(storePriceMatchRetryRuns.createdById, userId));
    await tx
      .update(externalSiteRuns)
      .set({ requestedById: null })
      .where(eq(externalSiteRuns.requestedById, userId));

    // Catalog history keeps the actor; only its personal fields change.
    await tx
      .update(actors)
      .set({
        displayName: DELETED_MEMBER_NAME,
        pictureUrl: null,
        active: false,
      })
      .where(eq(actors.id, actor.id));

    await tx
      .update(users)
      .set(deletedUserFields(userId, deletedAt))
      .where(eq(users.id, userId));

    return {
      bottleIds: [...tastingRows, ...reviewRows].map((row) => row.bottleId),
      imageUrls: [
        locked.pictureUrl,
        ...tastingRows.map((row) => row.imageUrl),
        ...reviewRows.map((row) => row.imageUrl),
        ...collectionRows.map((row) => row.imageUrl),
        ...pendingRows.map((row) => row.imageUrl),
      ].filter((url): url is string => Boolean(url)),
    };
  });

  if (!result) return false;

  await removeStoredImages(user.id, result.imageUrls);
  await dispatchBottleStatsRecomputes(
    "accountDeletion",
    user.id,
    result.bottleIds,
  );
  return true;
}

/** Best-effort: the account is already deleted, so failures are reported, not thrown. */
async function removeStoredImages(userId: number, imageUrls: string[]) {
  for (const imageUrl of new Set(imageUrls)) {
    try {
      await deleteUploadByUrl(imageUrl);
    } catch (error) {
      logError(error, {
        extra: { userId, operation: "accountDeletion.removeStoredImage" },
      });
    }
  }
}
