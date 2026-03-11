import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import {
  assignBottleAlias,
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleAliasSchema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
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
  .handler(async function ({ input, errors }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    try {
      await assignBottleAlias(
        {
          bottleId: input.bottle,
          name: input.name,
        },
        {
          bottle: {
            id: input.bottle,
          },
        },
      );
    } catch (err) {
      if (err instanceof DuplicateBottleAliasError) {
        throw errors.CONFLICT({
          message: err.message,
        });
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
