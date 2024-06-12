import { pgEnum } from "drizzle-orm/pg-core";

import {
  CATEGORY_LIST,
  FLAVOR_PROFILES,
  TAG_CATEGORIES,
} from "../../constants";

export const categoryEnum = pgEnum("category", CATEGORY_LIST);

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
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
