import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { buildEntitySearchVector } from "@peated/server/lib/search";
import { eq } from "drizzle-orm";

export default async ({ entityId }: { entityId: number }) => {
  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  const aliasList = await db
    .select()
    .from(entityAliases)
    .where(eq(entityAliases.entityId, entity.id));

  const searchVector = buildEntitySearchVector(entity, aliasList) || null;

  console.log(`Updating index for Entity ${entity.id}`);

  await db
    .update(entities)
    .set({
      searchVector,
    })
    .where(eq(entities.id, entity.id));
};
