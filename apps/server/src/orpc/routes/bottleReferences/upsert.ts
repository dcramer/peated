import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleReference,
  BottleReferenceBottleInactiveError,
  BottleReferenceBottleNotFoundError,
  BottleReferenceBottleRetiredError,
  ExactBottleReferenceConflictError,
  FailedToSaveBottleReferenceError,
} from "@peated/server/lib/bottleReferences";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleReferenceSchema } from "@peated/server/schemas";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/bottle-references",
    summary: "Upsert bottle reference",
    description:
      "Create or update a bottle reference and associate it with a bottle. Updates related prices and externalReviews. Requires moderator privileges",
    operationId: "upsertBottleReference",
  })
  .input(BottleReferenceSchema.strict())
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    try {
      const actor = await getUserActor(context.user);
      await assignBottleReference(
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
        err instanceof ExactBottleReferenceConflictError ||
        err instanceof BottleReferenceBottleInactiveError ||
        err instanceof BottleReferenceBottleRetiredError
      ) {
        throw errors.CONFLICT({ message: err.message });
      }

      if (err instanceof BottleReferenceBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: "Bottle not found." });
      }

      throw errors.INTERNAL_SERVER_ERROR({
        message:
          err instanceof FailedToSaveBottleReferenceError
            ? err.message
            : "Failed to save reference.",
      });
    }

    return {};
  });
