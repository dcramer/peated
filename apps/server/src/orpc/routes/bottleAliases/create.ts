import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasCanonicalNameError,
  BottleAliasDuplicateError,
  createBottleAlias,
} from "@peated/server/lib/bottleAliases";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/aliases",
    summary: "Add a Bottle alias",
    description:
      "Add a verified alternate marketed name. Requires moderator privileges.",
    operationId: "createBottleAlias",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(255),
    }),
  )
  .output(z.object({ id: z.number(), name: z.string(), createdAt: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const actor = await getUserActor(context.user);
      const alias = await createBottleAlias({
        bottleId: input.bottle,
        name: input.name,
        createdByActorId: actor.id,
      });
      try {
        await pushUniqueJob("IndexBottleSearchVectors", {
          bottleId: alias.bottleId,
        });
      } catch (error) {
        logError(error, { bottle: { id: alias.bottleId } });
      }
      return {
        id: alias.id,
        name: alias.name,
        createdAt: alias.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof BottleAliasBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message });
      }
      if (
        error instanceof BottleAliasBottleInactiveError ||
        error instanceof BottleAliasCanonicalNameError ||
        error instanceof BottleAliasDuplicateError
      ) {
        throw errors.CONFLICT({ message: error.message });
      }
      throw error;
    }
  });
