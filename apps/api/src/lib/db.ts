import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { first } from "../db";
import {
  Collection,
  Entity,
  EntityType,
  NewEntity,
  changes,
  collections,
  entities,
} from "../db/schema";

export type EntityInput =
  | number
  | {
      name: string;
      country?: string;
      region?: string;
      type?: ("brand" | "bottler" | "distiller")[];
    };

export type UpsertOutcome<T> =
  | {
      id: number;
      result?: T;
      created: false;
    }
  | {
      id: number;
      result: T;
      created: true;
    }
  | undefined;

export const upsertEntity = async ({
  db,
  data,
  userId,
  type,
}: {
  db: NodePgDatabase;
  data: EntityInput;
  userId: number;
  type?: EntityType;
}): Promise<UpsertOutcome<NewEntity>> => {
  if (!data) return undefined;

  if (typeof data === "number") {
    const result = first<Entity>(
      await db.select().from(entities).where(eq(entities.id, data)),
    );

    if (result && type && result.type.indexOf(type) === -1) {
      await db
        .update(entities)
        .set({ type: [...result.type, type] })
        .where(eq(entities.id, result.id));
    }
    return result ? { id: result.id, result, created: false } : undefined;
  }

  const result = first<Entity>(
    await db
      .insert(entities)
      .values({
        name: data.name,
        country: data.country || null,
        region: data.region || null,
        type: Array.from(
          new Set([...(type ? [type] : []), ...(data.type || [])]),
        ),
        createdById: userId,
      })
      .onConflictDoNothing()
      .returning(),
  );

  if (result) {
    await db.insert(changes).values({
      objectType: "entity",
      objectId: result.id,
      createdById: userId,
      data: JSON.stringify(result),
    });

    return { id: result.id, result, created: true };
  }

  const resultConflict = first<Entity>(
    await db.select().from(entities).where(eq(entities.name, data.name)),
  );

  if (resultConflict)
    return { id: resultConflict.id, result: resultConflict, created: false };
  throw new Error("We should never hit this case in upsert");
};

export const getDefaultCollection = async (
  db: NodePgDatabase,
  userId: number,
) => {
  return (
    first<Collection>(
      await db
        .select()
        .from(collections)
        .where(eq(collections.createdById, userId))
        .limit(1),
    ) ||
    first<Collection>(
      await db
        .insert(collections)
        .values({
          name: "Default",
          createdById: userId,
        })
        .onConflictDoNothing()
        .returning(),
    ) ||
    (
      await db
        .select()
        .from(collections)
        .where(eq(collections.createdById, userId))
        .limit(1)
    )[0]
  );
};
