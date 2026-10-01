import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { recordIncomingBottleDecisionInTransaction } from "@peated/server/lib/incomingBottleDecisionLog";
import {
  priceMatchProposalHistory,
  reopenStorePriceMatchesInTransaction,
} from "@peated/server/lib/reopenStorePriceMatches";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}/reopen",
    summary: "Reopen an unassigned price match",
    description:
      "Return an approved proposal whose Bottle match was cleared to moderator review. Requires moderator privileges. Does not run automatic matching.",
    operationId: "reopenPriceMatchQueueItem",
  })
  .input(
    z
      .object({
        proposal: z.coerce.number().int().positive(),
        expectedUpdatedAt: z.iso.datetime(),
        expectedSourceFingerprint: z.string().nullable(),
      })
      .strict(),
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
      if (
        row.proposal.status !== "approved" ||
        row.price.bottleId !== null ||
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
        rationale: "Reopened an already-cleared approval for moderator review.",
        metadata: {
          resolutionSource: "moderator_reopen",
          previousProposal: priceMatchProposalHistory(row.proposal),
        },
      });
      await reopenStorePriceMatchesInTransaction(tx, [row.price.id]);
    });
    return {};
  });
