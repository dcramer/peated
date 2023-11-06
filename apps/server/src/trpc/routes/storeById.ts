import { db } from "@peated/server/db";
import { stores } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StoreSerializer } from "@peated/server/serializers/store";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const [store] = await db.select().from(stores).where(eq(stores.id, input));
  if (!store) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }
  return await serialize(StoreSerializer, store, ctx.user);
});
