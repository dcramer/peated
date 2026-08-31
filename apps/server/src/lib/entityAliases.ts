/**
 * Entity aliases are other names shown in the product and used by search.
 * Entity references own automatic name matching.
 */
import {
  db,
  type AnyConnection,
  type AnyDatabase,
  type AnyTransaction,
} from "@peated/server/db";
import {
  entities,
  entityAliases,
  type EntityAlias,
} from "@peated/server/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export class EntityAliasEntityNotFoundError extends Error {
  constructor() {
    super("Entity not found.");
    this.name = "EntityAliasEntityNotFoundError";
  }
}

export class EntityAliasConflictError extends Error {
  constructor() {
    super("This Entity already has that name.");
    this.name = "EntityAliasConflictError";
  }
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function nameKey(name: string) {
  return normalizeName(name).toLocaleLowerCase("en-US");
}

export async function createEntityAlias(
  {
    entityId,
    name,
    createdByActorId,
  }: { entityId: number; name: string; createdByActorId: number },
  database: AnyConnection = db,
): Promise<EntityAlias> {
  const displayName = normalizeName(name);
  if (!displayName) throw new EntityAliasConflictError();
  const normalizedName = nameKey(displayName);

  return await database.transaction(async (tx) => {
    const [entity] = await tx
      .select({
        id: entities.id,
        name: entities.name,
        shortName: entities.shortName,
      })
      .from(entities)
      .where(eq(entities.id, entityId))
      .for("update");
    if (!entity) throw new EntityAliasEntityNotFoundError();

    if (
      nameKey(entity.name) === normalizedName ||
      (entity.shortName && nameKey(entity.shortName) === normalizedName)
    ) {
      throw new EntityAliasConflictError();
    }

    const existing = await tx.query.entityAliases.findFirst({
      where: and(
        eq(entityAliases.entityId, entityId),
        eq(entityAliases.normalizedName, normalizedName),
      ),
    });
    if (existing) throw new EntityAliasConflictError();

    const [alias] = await tx
      .insert(entityAliases)
      .values({ entityId, name: displayName, normalizedName, createdByActorId })
      .returning();
    if (!alias) throw new Error("Failed to add another Entity name.");
    return alias;
  });
}

export async function deleteEntityAlias(
  { entityId, aliasId }: { entityId: number; aliasId: number },
  database: AnyDatabase = db,
) {
  const [alias] = await database
    .delete(entityAliases)
    .where(
      and(eq(entityAliases.id, aliasId), eq(entityAliases.entityId, entityId)),
    )
    .returning();
  return Boolean(alias);
}

export async function removePrimaryEntityAliases(
  tx: AnyTransaction,
  entity: { id: number; name: string; shortName: string | null },
) {
  const primaryKeys = [entity.name, entity.shortName]
    .filter((name): name is string => Boolean(name))
    .map(nameKey);

  await tx
    .delete(entityAliases)
    .where(
      and(
        eq(entityAliases.entityId, entity.id),
        inArray(entityAliases.normalizedName, primaryKeys),
      ),
    );
}

export async function moveEntityAliases(
  tx: AnyTransaction,
  sourceEntityIds: readonly number[],
  destination: { id: number; name: string; shortName: string | null },
) {
  const aliases = await tx
    .select()
    .from(entityAliases)
    .where(
      inArray(entityAliases.entityId, [destination.id, ...sourceEntityIds]),
    )
    .orderBy(asc(entityAliases.id))
    .for("update");
  const destinationKeys = new Set(
    aliases
      .filter(({ entityId }) => entityId === destination.id)
      .map(({ normalizedName }) => normalizedName),
  );
  destinationKeys.add(nameKey(destination.name));
  if (destination.shortName) {
    destinationKeys.add(nameKey(destination.shortName));
  }

  for (const alias of aliases.filter(({ entityId }) =>
    sourceEntityIds.includes(entityId),
  )) {
    if (destinationKeys.has(alias.normalizedName)) {
      await tx.delete(entityAliases).where(eq(entityAliases.id, alias.id));
      continue;
    }
    await tx
      .update(entityAliases)
      .set({ entityId: destination.id, updatedAt: new Date() })
      .where(eq(entityAliases.id, alias.id));
    destinationKeys.add(alias.normalizedName);
  }
}
