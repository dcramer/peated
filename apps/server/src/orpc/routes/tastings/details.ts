import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TastingSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/tastings/{tasting}",
    summary: "Get tasting details",
    description: "Retrieve detailed information about a specific tasting",
    operationId: "getTasting",
  })
  .input(
    z.object({
      tasting: z.coerce.number(),
    }),
  )
  .output(TastingSchema)
  .handler(async function ({ input, context, errors }) {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting));

    if (!tasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    return await serialize(TastingSerializer, tasting, context.user);
  });
