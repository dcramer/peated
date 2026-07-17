import { db } from "@peated/server/db";
import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAlias,
  ExactBottleAliasConflictError,
  FailedToSaveBottleAliasError,
  InvalidExactBottleAliasTargetError,
} from "@peated/server/lib/bottleAliases";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetNotFoundError,
  CatalogTargetRetiredError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
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
      "Create or update a bottle alias and associate it with a bottle. Updates related prices and reviews. Requires moderator privileges",
    operationId: "upsertBottleAlias",
  })
  .input(BottleAliasSchema)
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    try {
      const target = await resolveCatalogTargetForAssignment(
        { kind: "bottle", bottleId: input.bottle },
        db,
      );
      const actor = await getUserActor(context.user);
      await assignBottleAlias(
        {
          bottleId: input.bottle,
          targetId: target.targetId,
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
        err instanceof CatalogTargetRetiredError ||
        err instanceof CatalogTargetIntegrityMismatchError ||
        err instanceof InvalidExactBottleAliasTargetError
      ) {
        throw errors.CONFLICT({ message: err.message });
      }

      if (err instanceof CatalogTargetNotFoundError) {
        const bottle = await db.query.bottles.findFirst({
          where: (bottles, { eq }) => eq(bottles.id, input.bottle),
          columns: { id: true },
        });
        if (bottle) {
          throw errors.CONFLICT({ message: err.message });
        }
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
