import type { InferSelectModel, Table } from "drizzle-orm";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import type { z } from "zod";
import type { AnyDatabase } from "../db";
import type { BottleAlias, Entity, EntityType } from "../db/schema";
import { bottleAliases, changes, collections, entities } from "../db/schema";
import type { EntityInputSchema, EntitySchema } from "../schemas";
import type { EntityInput } from "../types";

export type UpsertOutcome<T> =
  | {
      id: number;
      result: T;
      created: boolean;
    }
  | undefined;

export function coerceToUpsert({
  country,
  region,
  ...data
}:
  | z.infer<typeof EntityInputSchema>
  | z.infer<typeof EntitySchema>): EntityInput {
  const rv: EntityInput = { ...data };
  if (country instanceof Object) {
    rv.countryId = country.id;
  } else if (country) {
    rv.countryId = country;
  }
  if (region instanceof Object) {
    rv.regionId = region.id;
  } else if (region) {
    rv.regionId = region;
  }
  return rv;
}

export const upsertEntity = async ({
  db,
  data,
  userId,
  type,
}: {
  db: AnyDatabase;
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
  if (data.id === null) {
    data.id = undefined;
  }

  const [result] = await db
    .insert(entities)
    .values({
      ...data,
      type: Array.from(
        new Set([...(type ? [type] : []), ...(data.type || [])])
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

export const getDefaultCollection = async (db: AnyDatabase, userId: number) => {
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
      where: (collections, { eq }) =>
        and(
          eq(collections.createdById, userId),
          sql`LOWER(${collections.name}) = 'default'`
        ),
    }))
  );
};

export async function upsertBottleAlias(
  db: AnyDatabase,
  name: string,
  bottleId: number | null = null
) {
  // both of these force a useless update so RETURNING works
  const query = bottleId
    ? await db.execute<BottleAlias>(
        sql`INSERT INTO ${bottleAliases} (bottle_id, name)
      VALUES (${bottleId}, ${name})
      ON CONFLICT (LOWER(name))
      DO UPDATE SET bottle_id =
        CASE WHEN ${bottleAliases.bottleId} IS NULL
          THEN EXCLUDED.bottle_id
          ELSE ${bottleAliases.bottleId}
        END
      RETURNING *`
      )
    : await db.execute<BottleAlias>(
        sql`INSERT INTO ${bottleAliases} (bottle_id, name)
      VALUES (${bottleId}, ${name})
      ON CONFLICT (LOWER(name))
      DO UPDATE SET name = ${bottleAliases.name}
      RETURNING *`
      );

  return mapRows(query.rows, bottleAliases)[0];

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

export function mapRows<T extends TableConfig>(
  rows: Record<string, unknown>[],
  table: PgTableWithColumns<T>
): InferSelectModel<Table<T>>[] {
  const cols = Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([attr, col]) => [
      col.name,
      { col, attr },
    ])
  );

  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => {
        const r = cols[k];
        return [
          r ? r.attr : k,
          r ? (v !== null ? r.col.mapFromDriverValue(v) : v) : v,
        ];
      })
    )
  ) as unknown as InferSelectModel<Table<T>>[];
}
