import type { AnyDatabase } from "@peated/server/db";
import { changes, entities, type Actor } from "@peated/server/db/schema";
import { and, eq, isNull, ne, or } from "drizzle-orm";

import { getPublishedLeadText } from "./publicAbout";
import { loadLinkedEntities, type StoredEntityAbout } from "./store";

/**
 * A published, sourced lead replaces a generated or empty description, never
 * a person's or one of unknown origin. The check is in the update itself, so
 * an edit made during the run wins. Description rule (owner:
 * docs/features/entity-about.md): every save of a page runs it.
 */
export async function updateEntityDescription(
  tx: AnyDatabase,
  entity: { id: number; name: string },
  about: StoredEntityAbout,
  actor: Actor,
) {
  const description = getPublishedLeadText(
    about,
    await loadLinkedEntities(tx, [about.document]),
  );
  if (!description) return;
  const [updated] = await tx
    .update(entities)
    .set({ description, descriptionSrc: "generated", updatedAt: new Date() })
    .where(
      and(
        eq(entities.id, entity.id),
        or(
          isNull(entities.description),
          eq(entities.description, ""),
          and(
            eq(entities.descriptionSrc, "generated"),
            ne(entities.description, description),
          ),
        ),
      ),
    )
    .returning({ id: entities.id });
  if (!updated) return;
  await tx.insert(changes).values({
    objectType: "entity",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: "update",
    data: { description, descriptionSrc: "generated" },
  });
}
