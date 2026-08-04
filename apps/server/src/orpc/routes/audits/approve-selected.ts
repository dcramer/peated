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
    path: "/audits/{audit}/operations/approve",
    summary: "Approve selected audit operations",
    spec: (spec) => ({
      ...spec,
      operationId: "approveAuditOperations",
    }),
  })
  .input(
    ApproveBottleOperationsInputSchema.omit({ checkId: true }).extend({
      audit: ApproveBottleOperationsInputSchema.shape.checkId,
    }),
  )
  .output(BottleOperationActionResponseSchema)
  .handler(async ({ input, context }) => {
    return {
      results: await approveBottleOperations(
        {
          checkId: input.audit,
          operations: input.operations,
        },
        context.user,
      ),
    };
  });
