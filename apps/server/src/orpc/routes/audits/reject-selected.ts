import {
  BottleOperationCheckIdSchema,
  BottleOperationRejectionInputSchema,
  rejectBottleOperations,
} from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleOperationActionResponseSchema } from "@peated/server/schemas/bottleChecks";

const InputSchema = BottleOperationRejectionInputSchema.safeExtend({
  audit: BottleOperationCheckIdSchema,
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/audits/{audit}/operations/reject",
    summary: "Reject selected audit operations",
    spec: (spec) => ({
      ...spec,
      operationId: "rejectAuditOperations",
    }),
  })
  .input(InputSchema)
  .output(BottleOperationActionResponseSchema)
  .handler(async ({ input, context }) => {
    return {
      results: await rejectBottleOperations(
        {
          checkId: input.audit,
          operationIds: input.operationIds,
          reason: input.reason,
          note: input.note,
        },
        context.user,
      ),
    };
  });
