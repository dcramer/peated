import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottles, bottleSeries, changes } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({ method: "DELETE", path: "/bottle-series/:id" })
  .input(
    z.object({
      id: z.coerce.number(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context }) {
    const [series] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, input.id))
      .limit(1);
    if (!series) {
      throw new ORPCError("NOT_FOUND", {
        message: "Series not found.",
      });
    }

    await db.transaction(async (tx) => {
      await Promise.all([
        // Log the deletion in changes table
        tx.insert(changes).values({
          objectType: "bottle_series",
          objectId: series.id,
          createdById: context.user.id,
          displayName: series.name,
          type: "delete",
          data: series,
        }),

        // Update bottles to remove series reference
        tx
          .update(bottles)
          .set({ seriesId: null })
          .where(eq(bottles.seriesId, series.id)),
      ]);

      // Delete the series
      await tx.delete(bottleSeries).where(eq(bottleSeries.id, series.id));
    });

    return {};
  });
