import type { ProposedOperation } from "@peated/bottle-classifier";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleChecks,
  storePriceMatchAttempts,
} from "@peated/server/db/schema";
import {
  createBottleCheck,
  type CreateBottleCheckResult,
} from "@peated/server/lib/bottleChecks";
import { eq } from "drizzle-orm";

/**
 * Seeds a version 2 check that already owns catalog operations.
 * Production cannot create this shape anymore; compatibility tests still need
 * it to prove that existing persisted work remains safely moderated.
 */
export async function createLegacyStorePriceReviewCheck({
  artifacts,
  bottleId,
  database = db,
  price,
  proposal,
  storePriceAttemptId,
}: {
  artifacts: Record<string, unknown>;
  bottleId: number;
  database?: AnyDatabase;
  price: { id: number; name: string };
  proposal: ProposedOperation;
  storePriceAttemptId: number;
}): Promise<CreateBottleCheckResult> {
  return await database.transaction(async (tx) => {
    const attempt = await tx.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.id, storePriceAttemptId),
      columns: { priceId: true, proposalId: true },
    });
    if (!attempt || attempt.priceId !== price.id) {
      throw new Error(
        `Store-price attempt ${storePriceAttemptId} does not belong to price ${price.id}.`,
      );
    }

    const created = await createBottleCheck(
      {
        intent: "audit_bottle",
        input: { bottleId, origin: "moderator" },
        result: {
          summary: "Review the legacy catalog operation.",
          proposedOperations: [proposal],
          findings: [],
          artifacts,
        },
      },
      tx,
    );
    const [legacyCheck] = await tx
      .update(bottleChecks)
      .set({
        intent: "resolve_reference",
        origin: null,
        sourceKind: "store_price",
        sourceId: String(price.id),
        bottleId: null,
        subjectKey: JSON.stringify([
          "resolve_reference",
          "store_price",
          String(price.id),
        ]),
        inputSnapshot: {
          reference: { id: price.id, name: price.name },
        },
        output: {
          status: "classified",
          decision: {
            action: "no_match",
            candidateBottleIds: [],
            matchedBottleId: null,
            proposedBottle: null,
          },
          findings: [],
        },
        storePriceMatchAttemptId: storePriceAttemptId,
        storePriceMatchProposalId: attempt.proposalId,
      })
      .where(eq(bottleChecks.id, created.check.id))
      .returning();
    if (!legacyCheck) {
      throw new Error(`Bottle check ${created.check.id} was not found.`);
    }

    return {
      ...created,
      check: {
        ...legacyCheck,
        operations: created.check.operations,
      },
    };
  });
}
