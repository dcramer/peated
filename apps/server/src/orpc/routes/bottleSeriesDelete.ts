import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { db } from "../../db";
import { bottles, bottleSeries, changes } from "../../db/schema";
import { requireMod } from "../middleware";

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
