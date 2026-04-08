import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import {
  BottleReleaseAlreadyExistsError,
  BottleReleaseCreateBadRequestError,
  createBottleRelease,
} from "@peated/server/lib/createBottleRelease";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  BottleReleaseInputSchema,
  BottleReleaseSchema,
} from "@peated/server/schemas/bottleReleases";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottle-releases",
    summary: "Create bottle bottling",
    description:
      "Create a new bottling with specific edition, vintage, and cask details. Requires authentication",
    spec: (spec) => ({
      ...spec,
      operationId: "createBottleRelease",
    }),
  })
  .input(
    BottleReleaseInputSchema.extend({
      bottle: z.coerce.number(),
    }),
  )
  .output(BottleReleaseSchema)
  .handler(async function ({ input, context, errors }) {
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
      const release = await createBottleRelease({
        bottleId: input.bottle,
        input,
        user: context.user,
      });

      return await serialize(BottleReleaseSerializer, release, context.user);
    } catch (err) {
      if (err instanceof BottleReleaseAlreadyExistsError) {
        throw new ConflictError(
          { id: err.releaseId },
          undefined,
          "A release with these attributes already exists.",
        );
      }

      if (err instanceof BottleReleaseCreateBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
