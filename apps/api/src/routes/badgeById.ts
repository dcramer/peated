import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const [badge] = await db.select().from(badges).where(eq(badges.id, input));
  if (!badge) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }
  return await serialize(BadgeSerializer, badge, ctx.user);
});
