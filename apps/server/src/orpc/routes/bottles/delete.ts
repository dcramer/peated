import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleReleases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  collectionBottles,
  entities,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

function formatReferenceTypes(referenceTypes: string[]) {
  if (referenceTypes.length === 1) {
    return referenceTypes[0];
  }

  if (referenceTypes.length === 2) {
    return `${referenceTypes[0]} and ${referenceTypes[1]}`;
  }

  const lastReferenceType = referenceTypes[referenceTypes.length - 1];
  return `${referenceTypes.slice(0, -1).join(", ")}, and ${lastReferenceType}`;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "DELETE",
    path: "/bottles/{bottle}",
    summary: "Delete bottle",
    description:
      "Permanently delete a bottle and create a tombstone record. Requires admin privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "deleteBottle",
    }),
  })
  .input(z.object({ bottle: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId } = input;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleId))
      .limit(1);
    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const [
      distillerRows,
      releaseRows,
      tastingRows,
      collectionRows,
      flightRows,
    ] = await Promise.all([
      db
        .select({ distillerId: bottlesToDistillers.distillerId })
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id)),
      db
        .select({ id: bottleReleases.id })
        .from(bottleReleases)
        .where(eq(bottleReleases.bottleId, bottle.id)),
      db
        .select({ id: tastings.id })
        .from(tastings)
        .where(eq(tastings.bottleId, bottle.id))
        .limit(1),
      db
        .select({ id: collectionBottles.id })
        .from(collectionBottles)
        .where(eq(collectionBottles.bottleId, bottle.id))
        .limit(1),
      db
        .select({ flightId: flightBottles.flightId })
        .from(flightBottles)
        .where(eq(flightBottles.bottleId, bottle.id))
        .limit(1),
    ]);

    const blockingReferences: string[] = [];
    if (tastingRows.length > 0) {
      blockingReferences.push("tastings");
    }
    if (collectionRows.length > 0) {
      blockingReferences.push("collections");
    }
    if (flightRows.length > 0) {
      blockingReferences.push("flights");
    }

    if (blockingReferences.length > 0) {
      throw errors.BAD_REQUEST({
        message: `Cannot delete bottle while it is used in ${formatReferenceTypes(blockingReferences)}.`,
      });
    }

    const distillerIds = distillerRows.map(({ distillerId }) => distillerId);
    const releaseIds = releaseRows.map(({ id }) => id);
    const deletedReleaseMatchesAliases = releaseIds.length
      ? inArray(bottleAliases.releaseId, releaseIds)
      : sql`false`;
    const deletedReleaseMatchesReviews = releaseIds.length
      ? inArray(reviews.releaseId, releaseIds)
      : sql`false`;
    const deletedReleaseMatchesStorePrices = releaseIds.length
      ? inArray(storePrices.releaseId, releaseIds)
      : sql`false`;
    const deletedReleaseMatchesCurrentProposal = releaseIds.length
      ? inArray(storePriceMatchProposals.currentReleaseId, releaseIds)
      : sql`false`;
    const deletedReleaseMatchesSuggestedProposal = releaseIds.length
      ? inArray(storePriceMatchProposals.suggestedReleaseId, releaseIds)
      : sql`false`;

    const aliasFilters: SQL<unknown>[] = [
      eq(bottleAliases.bottleId, bottle.id),
    ];
    const reviewFilters: SQL<unknown>[] = [eq(reviews.bottleId, bottle.id)];
    const storePriceFilters: SQL<unknown>[] = [
      eq(storePrices.bottleId, bottle.id),
    ];
    const proposalFilters: SQL<unknown>[] = [
      eq(storePriceMatchProposals.currentBottleId, bottle.id),
      eq(storePriceMatchProposals.suggestedBottleId, bottle.id),
      eq(storePriceMatchProposals.parentBottleId, bottle.id),
    ];

    if (releaseIds.length > 0) {
      aliasFilters.push(deletedReleaseMatchesAliases);
      reviewFilters.push(deletedReleaseMatchesReviews);
      storePriceFilters.push(deletedReleaseMatchesStorePrices);
      proposalFilters.push(
        deletedReleaseMatchesCurrentProposal,
        deletedReleaseMatchesSuggestedProposal,
      );
    }

    await db.transaction(async (tx) => {
      await Promise.all([
        tx.insert(changes).values({
          objectType: "bottle",
          objectId: bottle.id,
          createdById: context.user.id,
          displayName: bottle.fullName,
          type: "delete",
          data: {
            ...bottle,
            distillerIds,
          },
        }),

        tx
          .update(entities)
          .set({ totalBottles: sql`${entities.totalBottles} - 1` })
          .where(
            and(
              inArray(
                entities.id,
                Array.from(
                  new Set([bottle.brandId, ...distillerIds, bottle.bottlerId]),
                ).filter(notEmpty),
              ),
              gt(entities.totalBottles, 0),
            ),
          ),

        tx.delete(bottleTags).where(eq(bottleTags.bottleId, bottle.id)),

        tx
          .delete(bottleFlavorProfiles)
          .where(eq(bottleFlavorProfiles.bottleId, bottle.id)),

        tx
          .delete(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, bottle.id)),

        tx
          .update(bottleAliases)
          .set({
            bottleId: sql`CASE
              WHEN ${bottleAliases.bottleId} = ${bottle.id}
                THEN NULL
              ELSE ${bottleAliases.bottleId}
            END`,
            releaseId: sql`CASE
              WHEN ${deletedReleaseMatchesAliases}
                THEN NULL
              ELSE ${bottleAliases.releaseId}
            END`,
          })
          .where(or(...aliasFilters)),

        tx
          .update(reviews)
          .set({
            bottleId: sql`CASE
              WHEN ${reviews.bottleId} = ${bottle.id}
                THEN NULL
              ELSE ${reviews.bottleId}
            END`,
            releaseId: sql`CASE
              WHEN ${deletedReleaseMatchesReviews}
                THEN NULL
              ELSE ${reviews.releaseId}
            END`,
          })
          .where(or(...reviewFilters)),

        tx
          .update(storePrices)
          .set({
            bottleId: sql`CASE
              WHEN ${storePrices.bottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePrices.bottleId}
            END`,
            releaseId: sql`CASE
              WHEN ${deletedReleaseMatchesStorePrices}
                THEN NULL
              ELSE ${storePrices.releaseId}
            END`,
          })
          .where(or(...storePriceFilters)),

        tx
          .update(storePriceMatchProposals)
          .set({
            currentBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.currentBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.currentBottleId}
            END`,
            currentReleaseId: sql`CASE
              WHEN ${deletedReleaseMatchesCurrentProposal}
                THEN NULL
              ELSE ${storePriceMatchProposals.currentReleaseId}
            END`,
            suggestedBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.suggestedBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.suggestedBottleId}
            END`,
            suggestedReleaseId: sql`CASE
              WHEN ${deletedReleaseMatchesSuggestedProposal}
                THEN NULL
              ELSE ${storePriceMatchProposals.suggestedReleaseId}
            END`,
            parentBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.parentBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.parentBottleId}
            END`,
            enteredQueueAt: sql`CASE
              WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
                THEN NOW()
              ELSE ${storePriceMatchProposals.enteredQueueAt}
            END`,
            status: sql`CASE
              WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
                THEN 'pending_review'::store_price_match_proposal_status
              ELSE ${storePriceMatchProposals.status}
            END`,
            reviewedById: sql`CASE
              WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
                THEN NULL
              ELSE ${storePriceMatchProposals.reviewedById}
            END`,
            reviewedAt: sql`CASE
              WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
                THEN NULL
              ELSE ${storePriceMatchProposals.reviewedAt}
            END`,
            updatedAt: sql`NOW()`,
          })
          .where(or(...proposalFilters)),

        tx.insert(bottleTombstones).values({
          bottleId: bottle.id,
        }),
      ]);
      await tx.delete(bottles).where(eq(bottles.id, bottle.id));
    });

    return {};
  });
