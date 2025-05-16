import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = EntitySchema.extend({
  createdBy: z
    .object({
      id: z.number(),
      username: z.string(),
    })
    .nullable(),
});

export default procedure
  .route({ method: "GET", path: "/entities/:id" })
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    let [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.id));
    if (!entity) {
      // check for a tombstone
      [entity] = await db
        .select({
          ...getTableColumns(entities),
        })
        .from(entityTombstones)
        .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
        .where(eq(entityTombstones.entityId, input.id));
      if (!entity) {
        throw errors.NOT_FOUND({
          message: "Entity not found.",
        });
      }
    }

    const createdBy = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.id, entity.createdById),
    });

    return {
      ...(await serialize(EntitySerializer, entity, context.user)),
      createdBy: createdBy
        ? await serialize(UserSerializer, createdBy, context.user)
        : null,
    };
  });
