import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { StorePriceSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  price: z.number(),
  hidden: z.boolean().optional(),
});

export default procedure
  .use(requireMod)
  .route({ method: "PATCH", path: "/prices/:price" })
  .input(InputSchema)
  .output(StorePriceSchema)
  .handler(async function ({ input, context }) {
    const { price: priceId, ...data } = input;

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, priceId));

    if (!price) {
      throw new ORPCError("NOT_FOUND");
    }

    if (Object.values(data).length === 0) {
      return await serialize(StorePriceSerializer, price, context.user);
    }

    const [newPrice] = await db
      .update(storePrices)
      .set(data)
      .where(eq(storePrices.id, priceId))
      .returning();

    if (!newPrice) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update price.",
      });
    }

    return await serialize(StorePriceSerializer, newPrice, context.user);
  });
