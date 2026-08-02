import {
  ModeratorBottleAuditInputSchema,
  runModeratorBottleAudit,
} from "@peated/server/agents/bottleClassifier/auditBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ModeratorBottleAuditResponseSchema } from "@peated/server/schemas/bottleChecks";
import { serializeBottleCheck } from "@peated/server/serializers/bottleCheck";

const InputSchema = ModeratorBottleAuditInputSchema.omit({
  bottleId: true,
}).extend({
  bottle: ModeratorBottleAuditInputSchema.shape.bottleId,
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/audit",
    summary: "Audit an existing Bottle",
    spec: (spec) => ({ ...spec, operationId: "auditBottle" }),
  })
  .input(InputSchema)
  .output(ModeratorBottleAuditResponseSchema)
  .handler(async ({ input }) => {
    const result = await runModeratorBottleAudit({
      bottleId: input.bottle,
      note: input.note,
    });
    return result.status === "clean"
      ? result
      : {
          status: result.status,
          check: serializeBottleCheck(result.check),
        };
  });
