import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  StorePriceSchema,
  StorePriceVolumeSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { and, eq, ne, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const InputSchema = z.object({
  price: z.coerce.number(),
  hidden: z.boolean().optional(),
  volume: StorePriceVolumeSchema.optional(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/prices/{price}",
    summary: "Update price",
    description:
      "Update store price properties such as visibility or the listed volume. Correcting the volume also corrects the listing's price history. Requires moderator privileges",
    operationId: "updatePrice",
  })
  .input(InputSchema)
  .output(StorePriceSchema)
  .handler(async function ({ input, context, errors }) {
    const { price: priceId, ...data } = input;

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, priceId));

    if (!price) {
      throw errors.NOT_FOUND({
        message: "Price not found.",
      });
    }

    if (Object.values(data).length === 0) {
      return await serialize(StorePriceSerializer, price, context.user);
    }

    const newPrice = await db.transaction(async (tx) => {
      if (data.volume !== undefined) {
        // A listing is one product, so its history shares its volume. A day
        // that already has a row at the corrected volume keeps that row.
        const sameDay = alias(storePriceHistories, "same_day");
        await tx
          .update(storePriceHistories)
          .set({ volume: data.volume })
          .where(
            and(
              eq(storePriceHistories.priceId, priceId),
              ne(storePriceHistories.volume, data.volume),
              notExists(
                tx
                  .select({ id: sameDay.id })
                  .from(sameDay)
                  .where(
                    and(
                      eq(sameDay.priceId, priceId),
                      eq(sameDay.volume, data.volume),
                      eq(sameDay.date, storePriceHistories.date),
                    ),
                  ),
              ),
            ),
          );
      }

      // The source fingerprint records the facts the scraper last observed,
      // including volume. Clearing it after a hand correction lets the next
      // scrape record the corrected facts without treating them as a new
      // product identity.
      const changes: Partial<typeof price> = { ...data };
      if (data.volume !== undefined && data.volume !== price.volume) {
        changes.sourceFingerprint = null;
      }
      const [updated] = await tx
        .update(storePrices)
        .set(changes)
        .where(eq(storePrices.id, priceId))
        .returning();
      return updated;
    });

    if (!newPrice) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update price.",
      });
    }

    return await serialize(StorePriceSerializer, newPrice, context.user);
  });
