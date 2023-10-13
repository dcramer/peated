import { pgEnum } from "drizzle-orm/pg-core";

import { CATEGORY_LIST } from "../../constants";

export const categoryEnum = pgEnum("category", CATEGORY_LIST);

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
  "comment",
  "entity",
  "tasting",
  "toast",
  "follow",
]);
