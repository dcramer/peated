import { db } from "@peated/server/db";
import { bottles, wrongPhotoMatches } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { deleteUploadByUrl } from "@peated/server/lib/uploads";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "PATCH",
    path: "/wrong-photo-matches/{wrongPhotoMatch}",
    summary: "Set correct bottle for wrong photo match",
    description:
      "Save the Bottle you chose after reporting a wrong photo match. Choosing the Bottle that was matched withdraws the report: the record and its photo are deleted. Another member's record returns not found.",
    operationId: "updateWrongPhotoMatch",
  })
  .input(
    z.object({
      wrongPhotoMatch: z.coerce.number(),
      correctBottle: z.number().describe("ID of the Bottle you chose"),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      withdrawn: z
        .boolean()
        .describe(
          "`true` when you chose the matched Bottle, so the report was deleted",
        ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const bottle = await db.query.bottles.findFirst({
      columns: { id: true },
      where: eq(bottles.id, input.correctBottle),
    });
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Bottle not found." });
    }

    const match = await db.query.wrongPhotoMatches.findFirst({
      columns: { id: true, wrongBottleId: true },
      where: and(
        eq(wrongPhotoMatches.id, input.wrongPhotoMatch),
        eq(wrongPhotoMatches.createdById, context.user.id),
      ),
    });
    if (!match) {
      throw errors.NOT_FOUND({ message: "Wrong photo match not found." });
    }

    // Retraction rule: picking the matched Bottle means the match was right,
    // so the report would be a false example for classifier checks. Delete it.
    if (bottle.id === match.wrongBottleId) {
      const [deleted] = await db
        .delete(wrongPhotoMatches)
        .where(eq(wrongPhotoMatches.id, match.id))
        .returning({ imageUrl: wrongPhotoMatches.imageUrl });
      if (deleted?.imageUrl) {
        try {
          await deleteUploadByUrl(deleted.imageUrl);
        } catch (err) {
          // The record is gone; a leftover file is only storage to clean up.
          logError(err, { wrongPhotoMatch: { id: match.id } });
        }
      }
      return { id: match.id, withdrawn: true };
    }

    await db
      .update(wrongPhotoMatches)
      .set({ correctBottleId: bottle.id })
      .where(eq(wrongPhotoMatches.id, match.id));

    return { id: match.id, withdrawn: false };
  });
