import { deleteEntityAlias } from "@peated/server/lib/entityAliases";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/aliases/{alias}",
    summary: "Delete an Entity alias",
    description: "Delete another name for an Entity. Requires a moderator.",
    operationId: "deleteEntityAlias",
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
      alias: z.coerce.number().int().positive(),
    }),
  )
  .output(z.object({}))
  .handler(async ({ input, errors }) => {
    const deleted = await deleteEntityAlias({
      entityId: input.entity,
      aliasId: input.alias,
    });
    if (!deleted) {
      throw errors.NOT_FOUND({ message: "Entity alias not found." });
    }
    await pushUniqueJob("IndexEntitySearchVectors", {
      entityId: input.entity,
    });
    return {};
  });
