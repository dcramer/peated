import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  bottleObservations,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { recordIncomingBottleDecisionInTransaction } from "@peated/server/lib/incomingBottleDecisionLog";
import {
  priceMatchProposalHistory,
  reopenStorePriceMatchesInTransaction,
} from "@peated/server/lib/reopenStorePriceMatches";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}/reopen",
    summary: "Reopen an approved price match",
    description:
      "Return an approved proposal to moderator review. Supply expectedBottleId and a reason to also clear a wrong Bottle match. Requires moderator privileges. Does not run automatic matching.",
    operationId: "reopenPriceMatchQueueItem",
  })
  .input(
    z
      .object({
        proposal: z.coerce.number().int().positive(),
        expectedUpdatedAt: z.iso.datetime(),
        expectedSourceFingerprint: z.string().nullable(),
        expectedBottleId: z.number().int().positive().nullable().default(null),
        reason: z.string().trim().min(1).max(500).optional(),
      })
      .strict()
      .refine(
        ({ expectedBottleId, reason }) => expectedBottleId === null || reason,
        "Give a reason when clearing a Bottle match.",
      ),
  )
  .output(z.object({}))
  .handler(async ({ input, context, errors }) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ proposal: storePriceMatchProposals, price: storePrices })
        .from(storePrices)
        .innerJoin(
          storePriceMatchProposals,
          eq(storePriceMatchProposals.priceId, storePrices.id),
        )
        .where(eq(storePriceMatchProposals.id, input.proposal))
        .for("update");
      if (!row)
        throw errors.NOT_FOUND({ message: "Price match proposal not found." });
      const previousBottleId = row.price.bottleId;
      if (
        row.proposal.status !== "approved" ||
        previousBottleId !== input.expectedBottleId ||
        row.proposal.updatedAt.getTime() !==
          new Date(input.expectedUpdatedAt).getTime() ||
        row.price.sourceFingerprint !== input.expectedSourceFingerprint ||
        row.proposal.processingToken !== null
      ) {
        throw errors.CONFLICT({
          message:
            "The approved proposal or its source changed. Reload it before reopening.",
        });
      }
      if (previousBottleId !== null) {
        // Store price matching owns this rule: a saved name would assign the
        // same Bottle again on the next scrape, so the name is corrected first.
        const reference = await findBottleReferenceAssignment(
          normalizeBottleReferenceKey(row.price.name),
          tx,
        );
        if (
          row.price.matchedReferenceId !== null ||
          reference?.bottleId === previousBottleId
        ) {
          throw errors.CONFLICT({
            message:
              "This listing matches a saved name for that Bottle. Correct the Bottle reference first.",
          });
        }
        await tx
          .update(storePrices)
          .set({ bottleId: null, updatedAt: sql`NOW()` })
          .where(eq(storePrices.id, row.price.id));
        // The approval saved this listing as evidence for the wrong Bottle.
        await tx
          .delete(bottleObservations)
          .where(
            and(
              eq(bottleObservations.sourceType, "store_price"),
              eq(bottleObservations.sourceKey, `store_price:${row.price.id}`),
              eq(bottleObservations.bottleId, previousBottleId),
            ),
          );
      }
      await recordIncomingBottleDecisionInTransaction(tx, {
        sourceKind: "store_price",
        sourceId: row.price.id,
        proposalId: row.proposal.id,
        externalSiteId: row.price.externalSiteId,
        name: row.price.name,
        url: row.price.url,
        actor: await getUserActorForDatabase(tx, context.user),
        bottleId: null,
        decision: "unassign",
        rationale:
          input.reason ??
          "Reopened an already-cleared approval for moderator review.",
        metadata: {
          resolutionSource: "moderator_reopen",
          previousBottleId,
          previousProposal: priceMatchProposalHistory(row.proposal),
        },
      });
      await reopenStorePriceMatchesInTransaction(tx, [row.price.id]);
    });
    return {};
  });
