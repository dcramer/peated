import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { db } from "../../db";
import { bottles, tastings } from "../../db/schema";
import { serialize } from "../../serializers";
import { BottleSerializer } from "../../serializers/bottle";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, input));

  if (!bottle) {
    throw new TRPCError({
      message: "Bottle not found.",
      code: "NOT_FOUND",
    });
  }

  const [{ count: totalPeople }] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${tastings.createdById})`,
    })
    .from(tastings)
    .where(eq(tastings.bottleId, bottle.id));

  return {
    ...(await serialize(BottleSerializer, bottle, ctx.user)),
    people: totalPeople,
  };
});
