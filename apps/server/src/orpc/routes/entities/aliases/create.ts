import { getUserActor } from "@peated/server/lib/actors";
import {
  createEntityAlias,
  EntityAliasConflictError,
  EntityAliasEntityNotFoundError,
} from "@peated/server/lib/entityAliases";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/aliases",
    summary: "Add an Entity alias",
    description: "Add another name for an Entity. Requires a moderator.",
    operationId: "createEntityAlias",
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(255),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      name: z.string(),
      isShortName: z.literal(false),
      createdAt: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const actor = await getUserActor(context.user);
      const alias = await createEntityAlias({
        entityId: input.entity,
        name: input.name,
        createdByActorId: actor.id,
      });
      await pushUniqueJob("IndexEntitySearchVectors", {
        entityId: alias.entityId,
      });
      return {
        id: alias.id,
        name: alias.name,
        isShortName: false as const,
        createdAt: alias.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof EntityAliasEntityNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message });
      }
      if (error instanceof EntityAliasConflictError) {
        throw errors.CONFLICT({ message: error.message });
      }
      throw error;
    }
  });
