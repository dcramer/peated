import {
  BottleAliasBottleNotFoundError,
  deleteBottleAlias,
} from "@peated/server/lib/bottleAliases";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/bottles/{bottle}/aliases/{alias}",
    summary: "Delete a Bottle alias",
    description:
      "Delete one displayed Bottle alias. Requires moderator privileges.",
    operationId: "deleteBottleAlias",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      alias: z.coerce.number().int().positive(),
    }),
  )
  .output(z.object({}))
  .handler(async ({ input, errors }) => {
    try {
      await deleteBottleAlias({ bottleId: input.bottle, aliasId: input.alias });
      try {
        await pushUniqueJob("IndexBottleSearchVectors", {
          bottleId: input.bottle,
        });
      } catch (error) {
        logError(error, { bottle: { id: input.bottle } });
      }
      return {};
    } catch (error) {
      if (error instanceof BottleAliasBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: "Bottle name not found." });
      }
      throw error;
    }
  });
