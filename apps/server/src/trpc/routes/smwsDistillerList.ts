import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { SMWS_DISTILLERY_CODES } from "@peated/server/lib/smws";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { inArray } from "drizzle-orm";
import { publicProcedure } from "..";

export default publicProcedure.query(async function ({ ctx }) {
  ctx.maxAge = 86400;

  const results = await db
    .select()
    .from(entities)
    .where(inArray(entities.name, Object.values(SMWS_DISTILLERY_CODES)));

  return {
    results: await serialize(EntitySerializer, results, ctx.user),
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
});
