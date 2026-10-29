import type { AnyDatabase } from "@peated/server/db";
import {
  actors,
  changes,
  entities,
  type Actor,
} from "@peated/server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

import { getPublishedLeadText } from "./publicAbout";
import { loadLinkedEntities, type StoredEntityAbout } from "./store";

export type DescriptionUpdate = {
  description: string;
  before: { description: string | null; descriptionSrc: string | null };
};

/**
 * Whether a person wrote the stored description: it is marked as theirs, or,
 * when its origin was never recorded, the last change that set a description
 * was made by a person, including the change that created the Entity.
 */
async function isPersonDescription(
  tx: AnyDatabase,
  entityId: number,
  current: { description: string | null; descriptionSrc: string | null },
) {
  if (!current.description) return false;
  if (current.descriptionSrc !== null) {
    return current.descriptionSrc === "user";
  }
  const [last] = await tx
    .select({ actorType: actors.type })
    .from(changes)
    .innerJoin(actors, eq(actors.id, changes.actorId))
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.objectId, entityId),
        sql`${changes.data}->>'description' <> ''`,
      ),
    )
    .orderBy(desc(changes.id))
    .limit(1);
  return last?.actorType === "user";
}

/**
 * The description an Entity's published About lead would set, or null when
 * it keeps its own. Description rule (owner: docs/features/entity-about.md):
 * the lead replaces any description a person did not write. Locks the Entity
 * row, so an edit made during an About save wins.
 */
export async function getDescriptionUpdate(
  tx: AnyDatabase,
  entityId: number,
  about: StoredEntityAbout,
): Promise<DescriptionUpdate | null> {
  const description = getPublishedLeadText(
    about,
    await loadLinkedEntities(tx, [about.document]),
  );
  if (!description) return null;
  const [current] = await tx
    .select({
      description: entities.description,
      descriptionSrc: entities.descriptionSrc,
    })
    .from(entities)
    .where(eq(entities.id, entityId))
    .for("no key update");
  if (!current || current.description === description) return null;
  if (await isPersonDescription(tx, entityId, current)) return null;
  return { description, before: current };
}

/**
 * Sets the description from the published About lead when the rule allows it.
 * The change keeps the old text in `before`. Every save of a page runs it.
 */
export async function updateEntityDescription(
  tx: AnyDatabase,
  entity: { id: number; name: string },
  about: StoredEntityAbout,
  actor: Actor,
) {
  const update = await getDescriptionUpdate(tx, entity.id, about);
  if (!update) return false;
  await tx
    .update(entities)
    .set({
      description: update.description,
      descriptionSrc: "generated",
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entity.id));
  await tx.insert(changes).values({
    objectType: "entity",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: "update",
    data: {
      description: update.description,
      descriptionSrc: "generated",
      before: update.before,
    },
  });
  return true;
}
