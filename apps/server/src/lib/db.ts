import { eq } from "drizzle-orm";
import type { DatabaseType, TransactionType } from "../db";
import type { Entity, EntityType } from "../db/schema";
import { changes, collections, countries, entities } from "../db/schema";
import { type EntityInput } from "../types";

export type UpsertOutcome<T> =
  | {
      id: number;
      result: T;
      created: boolean;
    }
  | undefined;

export const upsertEntity = async ({
  db,
  data,
  userId,
  type,
}: {
  db: DatabaseType | TransactionType;
  data: EntityInput;
  userId: number;
  type?: EntityType;
}): Promise<UpsertOutcome<Entity>> => {
  if (!data) return undefined;

  if (typeof data === "number" || data.id) {
    const entityId = typeof data === "number" ? data : Number(data.id);
    const result = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, entityId),
    });

    if (result && type && !result.type.includes(type)) {
      await db
        .update(entities)
        .set({ type: [...result.type, type] })
        .where(eq(entities.id, result.id));
    }
    return result ? { id: result.id, result, created: false } : undefined;
  }

  const [country] = data.country
    ? await db
        .select({ id: countries.id })
        .from(countries)
        .where(eq(countries.name, data.country))
        .limit(1)
    : [];

  const [result] = await db
    .insert(entities)
    .values({
      name: data.name,
      countryId: country ? country.id : null,
      region: data.region || null,
      type: Array.from(
        new Set([...(type ? [type] : []), ...(data.type || [])]),
      ),
      createdById: userId,
    })
    .onConflictDoNothing()
    .returning();

  if (result) {
    await db.insert(changes).values({
      objectType: "entity",
      objectId: result.id,
      displayName: result.name,
      type: "add",
      data: result,
      createdById: userId,
      createdAt: result.createdAt,
    });

    return { id: result.id, result, created: true };
  }

  const resultConflict = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, data.name),
  });

  if (resultConflict)
    return { id: resultConflict.id, result: resultConflict, created: false };
  throw new Error("We should never hit this case in upsert");
};

export const getDefaultCollection = async (
  db: DatabaseType | TransactionType,
  userId: number,
) => {
  return (
    (await db.query.collections.findFirst({
      where: (collections, { eq }) => eq(collections.createdById, userId),
    })) ||
    (
      await db
        .insert(collections)
        .values({
          name: "Default",
          createdById: userId,
        })
        .onConflictDoNothing()
        .returning()
    ).find(() => true) ||
    (await db.query.collections.findFirst({
      where: (collections, { eq }) => eq(collections.createdById, userId),
    }))
  );
};
