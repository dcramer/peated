import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "DELETE", path: "/tastings/:id/image" })
  .input(
    z.object({
      tasting: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      imageUrl: z.null(),
    }),
  )
  .handler(async function ({ input, context }) {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting))
      .limit(1);
    if (!tasting) {
      throw new ORPCError("NOT_FOUND", {
        message: "Tasting not found.",
      });
    }

    if (tasting.createdById !== context.user.id && !context.user.admin) {
      throw new ORPCError("FORBIDDEN", {
        message: "Cannot delete another user's tasting image.",
      });
    }

    // TODO: delete the image from storage
    await db
      .update(tastings)
      .set({
        imageUrl: null,
      })
      .where(eq(tastings.id, tasting.id));

    return {
      imageUrl: null,
    };
  });
