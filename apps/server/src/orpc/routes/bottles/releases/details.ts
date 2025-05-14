import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleReleases } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleReleaseSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/bottle-releases/:id" })
  .input(
    z.object({
      id: z.coerce.number(),
    }),
  )
  .output(BottleReleaseSchema)
  .handler(async function ({ input, context }) {
    const release = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, input.id),
      with: {
        bottle: true,
        createdBy: true,
      },
    });

    if (!release) {
      throw new ORPCError("NOT_FOUND", {
        message: "Release not found.",
      });
    }

    return await serialize(BottleReleaseSerializer, release, context.user);
  });
