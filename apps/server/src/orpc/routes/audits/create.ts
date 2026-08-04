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
    path: "/audits",
    summary: "Create an audit for an existing Bottle",
    spec: (spec) => ({ ...spec, operationId: "createAudit" }),
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
          audit: serializeBottleCheck(result.check),
        };
  });
