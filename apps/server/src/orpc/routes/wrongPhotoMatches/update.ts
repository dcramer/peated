import { db } from "@peated/server/db";
import { bottles, wrongPhotoMatches } from "@peated/server/db/schema";
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
      "Save the Bottle you chose after reporting a wrong photo match. Another member's record returns not found.",
    operationId: "updateWrongPhotoMatch",
  })
  .input(
    z.object({
      wrongPhotoMatch: z.coerce.number(),
      correctBottle: z.number().describe("ID of the Bottle you chose"),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const bottle = await db.query.bottles.findFirst({
      columns: { id: true },
      where: eq(bottles.id, input.correctBottle),
    });
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Bottle not found." });
    }

    const [updated] = await db
      .update(wrongPhotoMatches)
      .set({ correctBottleId: bottle.id })
      .where(
        and(
          eq(wrongPhotoMatches.id, input.wrongPhotoMatch),
          eq(wrongPhotoMatches.createdById, context.user.id),
        ),
      )
      .returning({ id: wrongPhotoMatches.id });
    if (!updated) {
      throw errors.NOT_FOUND({ message: "Wrong photo match not found." });
    }

    return { id: updated.id };
  });
