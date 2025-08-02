import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/tastings/{tasting}/image",
    summary: "Delete tasting image",
    spec: {},
    description:
      "Remove the image from a tasting. Requires authentication and ownership or admin privileges",
  })
  .input(z.object({ tasting: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const { tasting: tastingId } = input;

    const [targetTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tastingId))
      .limit(1);

    if (!targetTasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    if (targetTasting.createdById !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "Cannot delete another user's tasting image.",
      });
    }

    // TODO: delete the image from storage
    await db
      .update(tastings)
      .set({
        imageUrl: null,
      })
      .where(eq(tastings.id, targetTasting.id));

    return {};
  });
