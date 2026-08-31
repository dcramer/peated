import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleReferenceNotFoundError,
  BottleReferenceReviewConflictError,
  getBottleReferenceStateToken,
  reviewBottleReference,
} from "@peated/server/lib/bottleReferenceReview";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-references/{reference}/review",
    summary: "Review a Bottle reference",
    description:
      "Verify or quarantine one Bottle reference without changing existing consumers.",
    operationId: "reviewBottleReference",
  })
  .input(
    z.object({
      reference: z.coerce.number().int().positive(),
      action: z.enum(["verify", "quarantine"]),
      stateToken: z.string().length(64),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      name: z.string(),
      ignored: z.boolean().nullable(),
      reviewedAt: z.string(),
      stateToken: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const actor = await getUserActor(context.user);
      const reference = await reviewBottleReference({
        referenceId: input.reference,
        action: input.action,
        actorId: actor.id,
        stateToken: input.stateToken,
      });
      try {
        await pushJob("IndexBottleReference", { name: reference.name });
        if (reference.bottleId !== null) {
          await pushUniqueJob("IndexBottleSearchVectors", {
            bottleId: reference.bottleId,
          });
        }
      } catch (error) {
        logError(error, {
          bottleReference: { id: reference.id, name: reference.name },
        });
      }
      return {
        id: reference.id,
        name: reference.name,
        ignored: reference.ignored,
        reviewedAt: reference.reviewedAt!.toISOString(),
        stateToken: getBottleReferenceStateToken(reference),
      };
    } catch (error) {
      if (error instanceof BottleReferenceNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message });
      }
      if (error instanceof BottleReferenceReviewConflictError) {
        throw errors.CONFLICT({ message: error.message });
      }
      throw error;
    }
  });
