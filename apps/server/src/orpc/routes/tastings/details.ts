import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TastingSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/tastings/:id" })
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(TastingSchema)
  .handler(async function ({ input, context }) {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.id));

    if (!tasting) {
      throw new ORPCError("NOT_FOUND", {
        message: "Tasting not found.",
      });
    }

    return await serialize(TastingSerializer, tasting, context.user);
  });
