import {
  BottleOperationRejectionInputSchema,
  RejectBottleOperationsInputSchema,
  rejectBottleOperations,
} from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleOperationActionResponseSchema } from "@peated/server/schemas/bottleChecks";

const InputSchema = BottleOperationRejectionInputSchema.safeExtend({
  check: RejectBottleOperationsInputSchema.shape.checkId,
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/{check}/operations/reject",
    summary: "Reject selected Bottle operations",
    spec: (spec) => ({
      ...spec,
      operationId: "rejectBottleOperations",
    }),
  })
  .input(InputSchema)
  .output(BottleOperationActionResponseSchema)
  .handler(async ({ input, context }) => {
    return {
      results: await rejectBottleOperations(
        {
          checkId: input.check,
          operationIds: input.operationIds,
          reason: input.reason,
          note: input.note,
        },
        context.user,
      ),
    };
  });
