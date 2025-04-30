import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

const InputSchema = z.object({
  price: z.number(),
  hidden: z.boolean().optional(),
});

export async function priceUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const { price: priceId, ...data } = input;

  const [price] = await db
    .select()
    .from(storePrices)
    .where(eq(storePrices.id, priceId));

  if (!price) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  if (Object.values(data).length === 0) {
    return await serialize(StorePriceSerializer, price, ctx.user);
  }

  const [newPrice] = await db
    .update(storePrices)
    .set(data)
    .where(eq(storePrices.id, priceId))
    .returning();

  if (!newPrice) {
    throw new TRPCError({
      message: "Failed to update price.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(StorePriceSerializer, newPrice, ctx.user);
}

export default modProcedure.input(InputSchema).mutation(priceUpdate);
