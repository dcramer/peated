import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";
import {
  followMergedEntities,
  type StoredEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import type {
  AboutLinkedEntity,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";
import { inArray } from "drizzle-orm";
import { serializer } from ".";

type Attrs = { linkedEntities: Map<number, AboutLinkedEntity> };

/** Loads linked Entities, following merged Entities to the one they became. */
async function loadLinkedEntities(ids: number[]) {
  const linked = new Map<number, AboutLinkedEntity>();
  if (!ids.length) return linked;

  const target = await followMergedEntities(db, ids);

  const rows = await db
    .select({ id: entities.id, name: entities.name, kind: entities.kind })
    .from(entities)
    .where(inArray(entities.id, [...new Set(target.values())]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, targetId] of target) {
    const row = byId.get(targetId);
    if (row) linked.set(id, row);
  }
  return linked;
}

export const EntityAboutSerializer = serializer({
  name: "entityAbout",
  attrs: async (itemList: (StoredEntityAbout & { id: number })[]) => {
    const ids = new Set<number>();
    for (const item of itemList) {
      for (const event of item.document.events) {
        if (event.relatedEntityId) ids.add(event.relatedEntityId);
        if (event.newOwnerId) ids.add(event.newOwnerId);
      }
    }
    const linkedEntities = await loadLinkedEntities([...ids]);
    return Object.fromEntries(
      itemList.map((item) => [item.id, { linkedEntities } satisfies Attrs]),
    );
  },
  item: (item, attrs: Attrs): EntityAboutPublic =>
    toPublicEntityAbout(item, attrs.linkedEntities),
});
