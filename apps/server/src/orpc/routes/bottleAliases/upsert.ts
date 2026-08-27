import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAlias,
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  ExactBottleAliasConflictError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleAliasSchema } from "@peated/server/schemas";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/bottle-aliases",
    summary: "Upsert bottle alias",
    description:
      "Create or update a bottle alias and associate it with a bottle. Updates related prices and externalReviews. Requires moderator privileges",
    operationId: "upsertBottleAlias",
  })
  .input(BottleAliasSchema.strict())
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    try {
      const actor = await getUserActor(context.user);
      await assignBottleAlias(
        {
          bottleId: input.bottle,
          name: input.name,
          assignmentSource: "human_approved",
          assignedByActorId: actor.id,
        },
        {
          bottle: {
            id: input.bottle,
          },
        },
      );
    } catch (err) {
      if (
        err instanceof ExactBottleAliasConflictError ||
        err instanceof BottleAliasBottleInactiveError ||
        err instanceof BottleAliasBottleRetiredError
      ) {
        throw errors.CONFLICT({ message: err.message });
      }

      if (err instanceof BottleAliasBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: "Bottle not found." });
      }

      throw errors.INTERNAL_SERVER_ERROR({
        message:
          err instanceof FailedToSaveBottleAliasError
            ? err.message
            : "Failed to save alias.",
      });
    }

    return {};
  });
