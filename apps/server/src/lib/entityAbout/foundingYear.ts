import type { AnyDatabase } from "@peated/server/db";
import { changes, entities, type Actor } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

import { getPublishedFoundingYear } from "./publicAbout";
import { loadLinkedEntities, type StoredEntityAbout } from "./store";

/**
 * A published page's cited founding year replaces the Entity's, whoever set
 * it, since Peated does not record where a stored year came from. The change
 * keeps the old year in `before`. Founding year rule (owner:
 * docs/features/entity-about.md): every save of a page runs it.
 */
export async function updateEntityFoundingYear(
  tx: AnyDatabase,
  entity: { id: number; name: string },
  about: StoredEntityAbout,
  actor: Actor,
) {
  const yearEstablished = getPublishedFoundingYear(
    about,
    await loadLinkedEntities(tx, [about.document]),
  );
  if (yearEstablished === null) return;
  const [current] = await tx
    .select({ yearEstablished: entities.yearEstablished })
    .from(entities)
    .where(eq(entities.id, entity.id))
    .for("no key update");
  if (!current || current.yearEstablished === yearEstablished) return;

  await tx
    .update(entities)
    .set({ yearEstablished, updatedAt: new Date() })
    .where(eq(entities.id, entity.id));
  await tx.insert(changes).values({
    objectType: "entity",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: "update",
    data: {
      yearEstablished,
      before: { yearEstablished: current.yearEstablished },
    },
  });
}
