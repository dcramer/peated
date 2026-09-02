import { toTitleCase } from "@peated/server/lib/strings";
import type { Entity } from "@peated/server/types";

import type { EntityCatalogItem } from "@peated/web/components/pages/entityCatalog.stylex";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getEntityUrl } from "@peated/web/lib/urls";

export function toEntityCatalogItem(
  entity: Entity,
  isFollowing = entity.isFollowing,
): EntityCatalogItem {
  const location = [entity.region?.name, entity.country?.name]
    .filter((value): value is string => Boolean(value))
    .join(", ");
  const metadata = [
    entity.peatedId,
    toTitleCase(entity.kind),
    location || null,
  ].filter((value): value is string => value !== null);

  return {
    createBottleHref: getEntityBottleCreateHref(entity),
    href: getEntityUrl(entity),
    id: entity.id,
    isFollowing,
    metadata,
    name: entity.name,
    totalBottles: entity.totalBottles,
    totalTastings: entity.totalTastings,
  };
}
