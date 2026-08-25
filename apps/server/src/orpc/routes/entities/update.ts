import {
  EntityUpdateAuthorizationError,
  EntityUpdateConflictError,
  EntityUpdateFailedError,
  EntityUpdateInputSchema,
  EntityUpdateNotFoundError,
  updateEntity,
} from "@peated/server/lib/updateEntity";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { z } from "zod";

const InputSchema = EntityUpdateInputSchema.extend({
  entity: z.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/entities/{entity}",
    summary: "Update entity",
    description:
      "Update entity information including name, kind, owner, location, and description. Automatically updates related bottles and aliases. Requires moderator privileges",
    operationId: "updateEntity",
  })
  .input(InputSchema)
  .output(EntitySchema)
  .handler(async function ({ input, context, errors }) {
    const { entity: entityId, ...updateInput } = input;

    try {
      const result = await updateEntity({
        entityId,
        input: updateInput,
        user: context.user,
      });

      return await serialize(EntitySerializer, result.entity, context.user);
    } catch (error) {
      if (error instanceof EntityUpdateAuthorizationError) {
        throw errors.UNAUTHORIZED({ message: error.message, cause: error });
      }
      if (error instanceof EntityUpdateNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof EntityUpdateConflictError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof EntityUpdateFailedError) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: error.message,
          cause: error,
        });
      }
      throw error;
    }
  });
