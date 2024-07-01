import { db } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { type Context } from "../context";

export async function entityById({
  input,
  ctx,
}: {
  input: number;
  ctx: Context;
}) {
  let [entity] = await db.select().from(entities).where(eq(entities.id, input));
  if (!entity) {
    // check for a tommbstone
    [entity] = await db
      .select({
        ...getTableColumns(entities),
      })
      .from(entityTombstones)
      .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
      .where(eq(entityTombstones.entityId, input));
    if (!entity) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }
  }

  return await serialize(EntitySerializer, entity, ctx.user);
}

export default publicProcedure.input(z.number()).query(entityById);
