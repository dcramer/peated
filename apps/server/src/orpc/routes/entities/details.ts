import { db } from "@peated/server/db";
import {
  entities,
  entityFollows,
  entityTombstones,
} from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import entityDetailsContract from "@peated/server/orpc/contracts/entities/details";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { and, eq, getTableColumns } from "drizzle-orm";

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

  let isFollowing = false;
  if (context.user) {
    const [follow] = await db
      .select({ entityId: entityFollows.entityId })
      .from(entityFollows)
      .where(
        and(
          eq(entityFollows.userId, context.user.id),
          eq(entityFollows.entityId, entity.id),
        ),
      )
      .limit(1);
    isFollowing = Boolean(follow);
  }

  return {
    ...(await serialize(EntitySerializer, entity, context.user)),
    isFollowing,
  };
});
