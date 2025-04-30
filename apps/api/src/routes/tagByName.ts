import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";

export default publicProcedure.input(z.string()).query(async function ({
  input,
  ctx,
}) {
  const [tag] = await db.select().from(tags).where(eq(tags.name, input));
  if (!tag) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }
  return await serialize(TagSerializer, tag, ctx.user);
});
