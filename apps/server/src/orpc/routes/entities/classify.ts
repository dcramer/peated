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
    summary: "Run Entity classifier for one Entity",
    description:
      "Return read-only identity advice for one local Entity using server-assembled Bottle evidence, sibling targets, and optional web research. This operation does not propose or apply catalog changes.",
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
