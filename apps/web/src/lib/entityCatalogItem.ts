import type { Entity } from "@peated/server/types";

import type { EntityCatalogItem } from "@peated/web/components/pages/entityCatalog.stylex";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getEntityUrl } from "@peated/web/lib/urls";

import { getEntityIdentityProps } from "./entityIdentity";

type EntityWithOptionalPublicCount = Omit<
  Entity,
  "publicReviewAndTastingCount"
> &
  Partial<Pick<Entity, "publicReviewAndTastingCount">>;

export function getEntityReviewAndTastingCount(
  entity: Pick<Entity, "totalTastings"> &
    Partial<Pick<Entity, "publicReviewAndTastingCount">>,
) {
  // TODO(api-rollout): Remove this fallback after API releases without the combined count are retired.
  return entity.publicReviewAndTastingCount ?? entity.totalTastings;
}

export function toEntityCatalogItem(
  entity: EntityWithOptionalPublicCount,
  isFollowing = entity.isFollowing,
): EntityCatalogItem {
  return {
    ...getEntityIdentityProps(entity),
    createBottleHref: getEntityBottleCreateHref(entity),
    href: getEntityUrl(entity),
    id: entity.id,
    isFollowing,
    totalBottles: entity.totalBottles,
    publicReviewAndTastingCount: getEntityReviewAndTastingCount(entity),
  };
}
