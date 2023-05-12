import { eq } from "drizzle-orm";
import { first } from "../db";
import { NewEntity, changes, entities } from "../db/schema";

export type EntityInput =
  | number
  | { name: string; country: string; region?: string };

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
  db: any;
  data: EntityInput;
  userId: number;
  type?: "distiller" | "brand";
}): Promise<UpsertOutcome<NewEntity>> => {
  if (!data) return undefined;

  if (typeof data === "number") {
    const result = first(
      await db.select().from(entities).where(eq(entities.id, data)),
    );

    if (result && result.type.indexOf(type) === -1) {
      await db
        .update(entities)
        .set({ type: [...result.type, type] })
        .where(eq(entities.id, result.id));
    }
    return result ? { id: result.id, result, created: false } : undefined;
  }

  const result = first(
    await db
      .insert(entities)
      .values({
        name: data.name,
        country: data.country || null,
        region: data.region || null,
        type: [type],
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

  const resultConflict = first(
    await db.select().from(entities).where(eq(entities.name, data.name)),
  );

  if (resultConflict)
    return { id: resultConflict.id, result: resultConflict, created: false };
  throw new Error("We should never hit this case in upsert");
};
