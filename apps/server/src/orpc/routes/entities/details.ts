import { db } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import entityDetailsContract from "@peated/server/orpc/contracts/entities/details";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { eq, getTableColumns } from "drizzle-orm";

export default implement(entityDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { entity: entityId } = input;

  let [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));
  if (!entity) {
    // check for a tombstone
    [entity] = await db
      .select({
        ...getTableColumns(entities),
      })
      .from(entityTombstones)
      .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
      .where(eq(entityTombstones.entityId, entityId));
    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }
  }

  return await serialize(EntitySerializer, entity, context.user);
});
