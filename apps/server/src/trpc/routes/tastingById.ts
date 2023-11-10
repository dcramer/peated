import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, input));

  if (!tasting) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  return await serialize(TastingSerializer, tasting, ctx.user);
});
