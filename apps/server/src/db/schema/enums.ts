import { pgEnum } from "drizzle-orm/pg-core";

import {
  CATEGORY_LIST,
  FLAVOR_PROFILES,
  TAG_CATEGORIES,
} from "../../constants";

export const categoryEnum = pgEnum("category", CATEGORY_LIST);

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
  "bottle_release",
  "bottle_series",
  "comment",
  "entity",
  "tasting",
  "toast",
  "follow",
]);

export const flavorProfileEnum = pgEnum("flavor_profile", FLAVOR_PROFILES);

export const tagCategoryEnum = pgEnum("tag_category", TAG_CATEGORIES);

export const contentSourceEnum = pgEnum("content_source", [
  "generated",
  "user",
]);

export const legacyReleaseRepairReviewResolutionEnum = pgEnum(
  "legacy_release_repair_review_resolution",
  ["allow_create_parent", "blocked", "reuse_existing_parent"],
);
