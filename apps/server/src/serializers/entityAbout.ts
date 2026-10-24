import { db } from "@peated/server/db";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";
import {
  loadLinkedEntities,
  type StoredEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import type {
  AboutLinkedEntity,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";
import { serializer } from ".";

type Attrs = { linkedEntities: Map<number, AboutLinkedEntity> };

export const EntityAboutSerializer = serializer({
  name: "entityAbout",
  attrs: async (itemList: (StoredEntityAbout & { id: number })[]) => {
    const linkedEntities = await loadLinkedEntities(
      db,
      itemList.map((item) => item.document),
    );
    return Object.fromEntries(
      itemList.map((item) => [item.id, { linkedEntities } satisfies Attrs]),
    );
  },
  item: (item, attrs: Attrs): EntityAboutPublic =>
    toPublicEntityAbout(item, attrs.linkedEntities),
});
