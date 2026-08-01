import config from "@peated/server/config";
import { getBottleCheckForReview } from "@peated/server/lib/bottleChecks";
import { prepareBottleCheckReviewOperations } from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleCheckDetailsResponseSchema } from "@peated/server/schemas/bottleChecks";
import {
  serializeBottleCheck,
  serializeReviewOperation,
} from "@peated/server/serializers/bottleCheck";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottle-checks/{check}",
    summary: "Get a Bottle check",
    spec: (spec) => ({ ...spec, operationId: "getBottleCheck" }),
  })
  .input(z.object({ check: z.coerce.number().int().positive() }).strict())
  .output(BottleCheckDetailsResponseSchema)
  .handler(async ({ input, errors }) => {
    if (!config.BOTTLE_CHECK_MODERATOR_VISIBILITY) {
      throw errors.NOT_FOUND();
    }
    const check = await getBottleCheckForReview(input.check);
    if (!check) {
      throw errors.NOT_FOUND({ message: "Bottle check not found." });
    }
    const reviewOperations = await prepareBottleCheckReviewOperations(check);
    return {
      check: serializeBottleCheck(check),
      reviewOperations: reviewOperations.map((operation) => ({
        ...operation,
        review: serializeReviewOperation(operation.review),
      })),
    };
  });
