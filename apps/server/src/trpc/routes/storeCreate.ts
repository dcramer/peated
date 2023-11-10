import { db } from "@peated/server/db";
import { stores } from "@peated/server/db/schema";
import { StoreInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StoreSerializer } from "@peated/server/serializers/store";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "..";

export default adminProcedure.input(StoreInputSchema).mutation(async function ({
  input,
  ctx,
}) {
  const store = await db.transaction(async (tx) => {
    try {
      const [store] = await tx.insert(stores).values(input).returning();
      return store;
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "store_type") {
        throw new TRPCError({
          message: "Store with aggregator type already exists.",
          code: "CONFLICT",
        });
      }
      throw err;
    }
  });

  if (!store) {
    throw new TRPCError({
      message: "Failed to create store.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(StoreSerializer, store, ctx.user);
});
