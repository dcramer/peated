import { db, type AnyDatabase } from "@peated/server/db";
import { actors, users, type Actor, type User } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Actor resolution is the write-attribution boundary. Write paths should
 * resolve one actor here and store that actor id instead of treating users as
 * the only possible actor type.
 */
export const PEATED_SYSTEM_ACTOR_KEY = "peated";

const SYSTEM_ACTOR_DISPLAY_NAMES = {
  [PEATED_SYSTEM_ACTOR_KEY]: "Peated",
} as const;

export type SystemActorKey = keyof typeof SYSTEM_ACTOR_DISPLAY_NAMES;

/** Resolve a durable system actor row for non-user writes. */
export async function getSystemActorForDatabase(
  targetDb: AnyDatabase,
  key: SystemActorKey,
): Promise<Actor> {
  const [actor] = await targetDb
    .insert(actors)
    .values({
      type: "system",
      key,
      displayName: SYSTEM_ACTOR_DISPLAY_NAMES[key],
      userId: null,
    })
    .onConflictDoUpdate({
      target: [actors.type, actors.key],
      set: {
        displayName: SYSTEM_ACTOR_DISPLAY_NAMES[key],
        active: true,
      },
    })
    .returning();

  if (!actor) {
    throw new Error(`Unable to resolve system actor: ${key}`);
  }

  return actor;
}

export function getSystemActor(key: SystemActorKey): Promise<Actor> {
  return getSystemActorForDatabase(db, key);
}

export function getPeatedSystemActor() {
  return getSystemActor(PEATED_SYSTEM_ACTOR_KEY);
}

export function getPeatedSystemActorForDatabase(targetDb: AnyDatabase) {
  return getSystemActorForDatabase(targetDb, PEATED_SYSTEM_ACTOR_KEY);
}

/** Resolve a durable user actor row, refreshing denormalized display fields. */
export async function getUserActorForDatabase(
  targetDb: AnyDatabase,
  user: Pick<User, "id" | "username">,
) {
  const [actor] = await targetDb
    .insert(actors)
    .values({
      type: "user",
      key: String(user.id),
      displayName: user.username,
      userId: user.id,
    })
    .onConflictDoUpdate({
      target: [actors.type, actors.key],
      set: {
        displayName: user.username,
        userId: user.id,
        active: true,
      },
    })
    .returning();

  if (!actor) {
    throw new Error(`Unable to resolve user actor: ${user.id}`);
  }

  return actor;
}

export function getUserActor(user: Pick<User, "id" | "username">) {
  return getUserActorForDatabase(db, user);
}

export async function getUserActorByIdForDatabase(
  targetDb: AnyDatabase,
  userId: number,
) {
  const [user] = await targetDb
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new Error(`Unable to resolve user actor for unknown user: ${userId}`);
  }

  return getUserActorForDatabase(targetDb, user);
}
