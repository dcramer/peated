import type { Entity } from "@peated/server/types";

import type { EntityCatalogItem } from "@peated/web/components/pages/entityCatalog.stylex";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getEntityUrl } from "@peated/web/lib/urls";

import { getEntityIdentityProps } from "./entityIdentity";

export function toEntityCatalogItem(
  entity: Entity,
  isFollowing = entity.isFollowing,
): EntityCatalogItem {
  return {
    ...getEntityIdentityProps(entity),
    createBottleHref: getEntityBottleCreateHref(entity),
    href: getEntityUrl(entity),
    id: entity.id,
    isFollowing,
    totalBottles: entity.totalBottles,
    totalTastings: entity.totalTastings,
  };
}
