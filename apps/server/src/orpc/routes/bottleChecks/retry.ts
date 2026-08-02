import config from "@peated/server/config";
import {
  BottleOperationActionResultSchema,
  RetryBottleOperationInputSchema,
  retryBottleOperation,
} from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/{check}/operations/{operation}/retry",
    summary: "Retry a failed Bottle operation",
    spec: (spec) => ({
      ...spec,
      operationId: "retryBottleOperation",
    }),
  })
  .input(
    z
      .object({
        check: RetryBottleOperationInputSchema.shape.checkId,
        operation: RetryBottleOperationInputSchema.shape.operationId,
      })
      .strict(),
  )
  .output(BottleOperationActionResultSchema)
  .handler(async ({ input, context, errors }) => {
    if (!config.BOTTLE_CHECK_MODERATOR_VISIBILITY) {
      throw errors.NOT_FOUND();
    }
    return await retryBottleOperation(
      {
        checkId: input.check,
        operationId: input.operation,
      },
      context.user,
    );
  });
