import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleReferences,
  bottleSeries,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  collectionBottles,
  externalReviews,
  flightBottles,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  getBottleEntityLinks,
  updateEntityBottleCounts,
} from "@peated/server/lib/entityBottleCounts";
import {
  getBottleProductionLocations,
  updateLocationBottleCounts,
} from "@peated/server/lib/locationBottleCounts";
import { logInfo } from "@peated/server/lib/log";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
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
      "Delete an unused bottle while reserving its public ID so it cannot be reused. Requires administrator privileges.",
    spec: (spec) => ({
      ...spec,
      operationId: "deleteBottle",
    }),
  })
  .input(z.object({ bottle: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId } = input;
    await db.transaction(async (tx) => {
      const [discoveredBottle] = await tx
        .select({ id: bottles.id, groupId: bottles.groupId })
        .from(bottles)
        .where(eq(bottles.id, bottleId))
        .limit(1);
      if (!discoveredBottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
        });
      }

      let bottle: typeof bottles.$inferSelect | undefined;
      let remainingGroupMemberIds: number[] = [];
      let groupRepresentativeBottleId: number | null = null;
      if (discoveredBottle.groupId === null) {
        [bottle] = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.id, bottleId))
          .limit(1)
          .for("update");
        if (!bottle) {
          throw errors.NOT_FOUND({
            message: "Bottle not found.",
          });
        }
        if (bottle.groupId !== null) {
          throw errors.CONFLICT({
            message: `Bottle ${bottle.id} changed groups before deletion.`,
          });
        }
      } else {
        // BottleGroup writes own this order: lock the group, then all members
        // by ID. Statistics and repair use the same order.
        const [group] = await tx
          .select({
            id: bottleGroups.id,
            representativeBottleId: bottleGroups.representativeBottleId,
          })
          .from(bottleGroups)
          .where(eq(bottleGroups.id, discoveredBottle.groupId))
          .limit(1)
          .for("update");
        if (!group) {
          const currentBottle = await tx.query.bottles.findFirst({
            columns: { id: true },
            where: eq(bottles.id, bottleId),
          });
          if (!currentBottle) {
            throw errors.NOT_FOUND({ message: "Bottle not found." });
          }
          throw errors.CONFLICT({
            message: `Bottle ${bottleId} belongs to a missing BottleGroup.`,
          });
        }

        const groupMembers = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.groupId, group.id))
          .orderBy(asc(bottles.id))
          .for("update");
        bottle = groupMembers.find(({ id }) => id === bottleId);
        if (!bottle) {
          const currentBottle = await tx.query.bottles.findFirst({
            columns: { groupId: true },
            where: eq(bottles.id, bottleId),
          });
          if (!currentBottle) {
            throw errors.NOT_FOUND({ message: "Bottle not found." });
          }
          throw errors.CONFLICT({
            message: `Bottle ${bottleId} changed groups before deletion.`,
          });
        }
        remainingGroupMemberIds = groupMembers
          .map(({ id }) => id)
          .filter((id) => id !== bottleId);
        groupRepresentativeBottleId = group.representativeBottleId;
      }

      const entityLinksBefore = await getBottleEntityLinks(tx, [bottle.id]);
      const locationsBefore = await getBottleProductionLocations(tx, [
        bottle.id,
      ]);

      const distillerRows = await tx
        .select({ distillerId: bottlesToDistillers.distillerId })
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id));
      const tastingRows = await tx
        .select({ id: tastings.id })
        .from(tastings)
        .where(eq(tastings.bottleId, bottle.id))
        .limit(1);
      const collectionRows = await tx
        .select({ id: collectionBottles.id })
        .from(collectionBottles)
        .where(eq(collectionBottles.bottleId, bottle.id))
        .limit(1);
      const flightRows = await tx
        .select({ flightId: flightBottles.flightId })
        .from(flightBottles)
        .where(eq(flightBottles.bottleId, bottle.id))
        .limit(1);

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

      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const distillerIds = distillerRows.map(({ distillerId }) => distillerId);
      const aliasFilters: SQL<unknown>[] = [
        eq(bottleReferences.bottleId, bottle.id),
      ];
      const reviewFilters: SQL<unknown>[] = [
        eq(externalReviews.bottleId, bottle.id),
      ];
      const storePriceFilters: SQL<unknown>[] = [
        eq(storePrices.bottleId, bottle.id),
      ];
      const proposalFilters: SQL<unknown>[] = [
        eq(storePriceMatchProposals.currentBottleId, bottle.id),
        eq(storePriceMatchProposals.suggestedBottleId, bottle.id),
        eq(storePriceMatchProposals.legacyParentBottleId, bottle.id),
      ];

      if (
        bottle.groupId !== null &&
        groupRepresentativeBottleId === bottle.id
      ) {
        await tx
          .update(bottleGroups)
          .set({
            representativeBottleId: remainingGroupMemberIds[0] ?? null,
          })
          .where(eq(bottleGroups.id, bottle.groupId));
      }

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: bottle.id,
        actorId,
        displayName: bottle.fullName,
        type: "delete",
        data: {
          ...bottle,
          distillerIds,
        },
      });
      await tx.delete(bottleTags).where(eq(bottleTags.bottleId, bottle.id));
      await tx
        .delete(bottleFlavorProfiles)
        .where(eq(bottleFlavorProfiles.bottleId, bottle.id));
      await tx
        .delete(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id));
      await tx
        .update(bottleReferences)
        .set({ bottleId: null })
        .where(or(...aliasFilters));
      await tx
        .update(externalReviews)
        .set({ bottleId: null })
        .where(or(...reviewFilters));
      await tx
        .update(storePrices)
        .set({ bottleId: null })
        .where(or(...storePriceFilters));
      await tx
        .update(storePriceMatchProposals)
        .set({
          currentBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.currentBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.currentBottleId}
            END`,
          suggestedBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.suggestedBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.suggestedBottleId}
            END`,
          legacyParentBottleId: sql`CASE
              WHEN ${storePriceMatchProposals.legacyParentBottleId} = ${bottle.id}
                THEN NULL
              ELSE ${storePriceMatchProposals.legacyParentBottleId}
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
        .where(or(...proposalFilters));
      await tx
        .update(bottleTombstones)
        .set({ newBottleId: null })
        .where(eq(bottleTombstones.newBottleId, bottle.id));
      await tx.insert(bottleTombstones).values({ bottleId: bottle.id });
      await tx
        .delete(bottleAliases)
        .where(eq(bottleAliases.bottleId, bottle.id));
      await tx.delete(bottles).where(eq(bottles.id, bottle.id));

      const entityLinksAfter = await getBottleEntityLinks(tx, [bottle.id]);
      await updateEntityBottleCounts(tx, entityLinksBefore, entityLinksAfter);
      const locationsAfter = await getBottleProductionLocations(tx, [
        bottle.id,
      ]);
      await updateLocationBottleCounts(tx, locationsBefore, locationsAfter);

      if (bottle.groupId !== null) {
        if (remainingGroupMemberIds.length === 0) {
          await tx
            .delete(bottleGroupDistillers)
            .where(eq(bottleGroupDistillers.groupId, bottle.groupId));
          await tx
            .delete(bottleGroups)
            .where(eq(bottleGroups.id, bottle.groupId));
        } else {
          await recomputeBottleGroupStatsInTransaction(tx, bottle.groupId);
        }
      }

      if (bottle.seriesId !== null) {
        await tx
          .update(bottleSeries)
          .set({
            numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${bottle.seriesId})`,
          })
          .where(eq(bottleSeries.id, bottle.seriesId));
      }
    });

    logInfo("Bottle deleted", {
      extra: {
        event: "bottle.delete",
        access: "write",
        caller: "bottles.delete",
        bottleId,
      },
    });

    return {};
  });
