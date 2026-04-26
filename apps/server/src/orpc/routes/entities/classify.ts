import { EntityClassificationResultSchema } from "@peated/entity-classifier";
import { classifyEntity as classifyEntityWithAgent } from "@peated/server/agents/entityClassifier";
import { getEntityClassificationReference } from "@peated/server/lib/entityAuditCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/classify",
    summary: "Run entity classifier for one entity",
    description:
      "Run the entity classifier against one local entity row using server-assembled bottle evidence, sibling targets, and optional web research.",
    spec: (spec) => ({
      ...spec,
      operationId: "classifyEntity",
    }),
  })
  .input(
    z.object({
      entity: z.coerce.number(),
    }),
  )
  .output(EntityClassificationResultSchema)
  .handler(async function ({ input, errors }) {
    const reference = await getEntityClassificationReference({
      entity: input.entity,
    });

    if (!reference) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    return await classifyEntityWithAgent({
      reference,
    });
  });
