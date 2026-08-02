import {
  ApproveBottleOperationsInputSchema,
  approveBottleOperations,
} from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleOperationActionResponseSchema } from "@peated/server/schemas/bottleChecks";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/{check}/operations/approve",
    summary: "Approve selected Bottle operations",
    spec: (spec) => ({
      ...spec,
      operationId: "approveBottleOperations",
    }),
  })
  .input(
    ApproveBottleOperationsInputSchema.omit({ checkId: true }).extend({
      check: ApproveBottleOperationsInputSchema.shape.checkId,
    }),
  )
  .output(BottleOperationActionResponseSchema)
  .handler(async ({ input, context }) => {
    return {
      results: await approveBottleOperations(
        {
          checkId: input.check,
          operationIds: input.operationIds,
        },
        context.user,
      ),
    };
  });
