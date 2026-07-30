import {
  ModeratorBottleAuditInputSchema,
  runModeratorBottleAudit,
} from "@peated/server/agents/bottleClassifier/auditBottle";
import config from "@peated/server/config";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleCheckResponseSchema, serializeBottleCheck } from "./schemas";

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
  .output(BottleCheckResponseSchema)
  .handler(async ({ input, errors }) => {
    if (
      !config.BOTTLE_CHECK_MODERATOR_VISIBILITY ||
      !config.BOTTLE_CHECK_SHADOW_GENERATION
    ) {
      throw errors.NOT_FOUND();
    }

    const result = await runModeratorBottleAudit({
      bottleId: input.bottle,
      note: input.note,
    });
    return serializeBottleCheck(result.check);
  });
