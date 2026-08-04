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
    path: "/audits/{audit}/operations/{operation}/retry",
    summary: "Retry a failed audit operation",
    spec: (spec) => ({
      ...spec,
      operationId: "retryAuditOperation",
    }),
  })
  .input(
    z
      .object({
        audit: RetryBottleOperationInputSchema.shape.checkId,
        operation: RetryBottleOperationInputSchema.shape.operationId,
      })
      .strict(),
  )
  .output(BottleOperationActionResultSchema)
  .handler(async ({ input, context }) => {
    return await retryBottleOperation(
      {
        checkId: input.audit,
        operationId: input.operation,
      },
      context.user,
    );
  });
