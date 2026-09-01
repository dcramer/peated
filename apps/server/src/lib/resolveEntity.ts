import { db } from "@peated/server/db";
import {
  entities,
  entityTombstones,
  type Entity,
} from "@peated/server/db/schema";
import { eq, getTableColumns } from "drizzle-orm";

/** Resolves an Entity ID through its canonical tombstone, when present. */
export async function resolveEntity(
  entityId: number,
): Promise<Entity | undefined> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));
  if (entity) return entity;

  const [canonicalEntity] = await db
    .select({
      ...getTableColumns(entities),
    })
    .from(entityTombstones)
    .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
    .where(eq(entityTombstones.entityId, entityId));

  return canonicalEntity;
}
