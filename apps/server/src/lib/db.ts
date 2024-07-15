import { eq, sql } from "drizzle-orm";
import { type z } from "zod";
import type { DatabaseType, TransactionType } from "../db";
import type { Entity, EntityType } from "../db/schema";
import { bottleAliases, changes, collections, entities } from "../db/schema";
import { type EntityInputSchema, type EntitySchema } from "../schemas";
import { type EntityInput } from "../types";

export type UpsertOutcome<T> =
  | {
      id: number;
      result: T;
      created: boolean;
    }
  | undefined;

export function coerceToUpsert(
  data: z.infer<typeof EntityInputSchema> | z.infer<typeof EntitySchema>,
): EntityInput {
  const rv: EntityInput = { ...data };
  if (data.country instanceof Object) {
    rv.countryId = data.country.id;
  }
  if (data.region instanceof Object) {
    rv.regionId = data.region.id;
  }
  return data;
}

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

  const [result] = await db
    .insert(entities)
    .values({
      name: data.name,
      countryId: data.countryId,
      regionId: data.regionId,
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

export async function upsertBottleAlias(
  db: DatabaseType | TransactionType,
  bottleId: number,
  name: string,
) {
  await db.execute(
    sql`INSERT INTO ${bottleAliases} (bottle_id, name)
      VALUES (${bottleId}, ${name})
      ON CONFLICT (LOWER(${bottleAliases.name}))
      DO UPDATE SET bottle_id = excluded.bottle_id WHERE ${bottleAliases.bottleId} IS NULL`,
  );

  // TODO: target does not yet support our constraint ref
  // await tx
  //   .insert(bottleAliases)
  //   .values({
  //     bottleId: bottle.id,
  //     name: aliasName,
  //     createdAt: bottle.createdAt,
  //   })
  //   .onConflictDoUpdate({
  //     target: sql`LOWER($bottleAliases.name})`,
  //     targetWhere: sql`LOWER(${bottleAliases.name}) = ${aliasName}`,
  //     set: {
  //       bottleId: bottle.id,
  //     },
  //     setWhere: isNull(bottleAliases.bottleId),
  //   });
}
