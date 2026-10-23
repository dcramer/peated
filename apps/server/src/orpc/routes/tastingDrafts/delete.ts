import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { TastingDraftIdInputSchema } from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { removeTastingDraftPhoto } from "./shared";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/tasting-drafts/{draft}",
    summary: "Delete tasting draft",
    description:
      "Delete one of your own tasting drafts and its photo. Another member's draft returns not found.",
    operationId: "deleteTastingDraft",
  })
  .input(TastingDraftIdInputSchema)
  .output(z.object({}))
  .handler(async ({ input, context, errors }) => {
    const [deleted] = await db
      .delete(tastingDrafts)
      .where(
        and(
          eq(tastingDrafts.id, input.draft),
          eq(tastingDrafts.createdById, context.user.id),
        ),
      )
      .returning({ imageUrl: tastingDrafts.imageUrl });
    if (!deleted) {
      throw errors.NOT_FOUND({ message: "Draft not found." });
    }

    if (deleted.imageUrl) {
      await removeTastingDraftPhoto(deleted.imageUrl, input.draft);
    }

    return {};
  });
