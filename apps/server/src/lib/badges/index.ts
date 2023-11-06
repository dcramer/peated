import type { BadgeType } from "../../types";

import type { DatabaseType, TransactionType } from "../../db";
import type { Badge } from "../../db/schema";
import type { TastingWithRelations } from "./base";
import { BottleBadge } from "./bottleBadge";
import { CategoryBadge } from "./categoryBadge";
import { RegionBadge } from "./regionBadge";

function getBadgeImpl(type: BadgeType) {
  switch (type) {
    case "bottle":
      return BottleBadge;
    case "category":
      return CategoryBadge;
    case "region":
      return RegionBadge;
    default:
      throw new Error(`Invalid badge type: ${type}`);
  }
}

// TODO(dcramer): at some point we'll want to cache this/optimize the db layer
// but for now its probably fine
export async function checkBadges(
  db: DatabaseType | TransactionType,
  tasting: TastingWithRelations,
): Promise<Badge[]> {
  const badgeList = await db.query.badges.findMany();
  return badgeList.filter((badge) => {
    const impl = getBadgeImpl(badge.type);
    // how to type this? does it even matter?
    return impl.test(badge.config as any, tasting);
  });
}

export async function checkBadgeConfig(type: BadgeType, config: unknown) {
  const impl = getBadgeImpl(type);
  return await impl.checkConfig(config);
}
