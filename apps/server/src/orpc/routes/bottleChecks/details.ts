import config from "@peated/server/config";
import { getBottleCheckForReview } from "@peated/server/lib/bottleChecks";
import { prepareBottleCheckReviewOperations } from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";
import {
  BottleCheckDetailsResponseSchema,
  serializeBottleCheck,
} from "./schemas";

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
    return {
      check: serializeBottleCheck(check),
      reviewOperations: await prepareBottleCheckReviewOperations(check),
    };
  });
