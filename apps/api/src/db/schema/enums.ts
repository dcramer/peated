import { pgEnum } from "drizzle-orm/pg-core";

import { CATEGORY_LIST } from "@peated/shared/constants";

export const categoryEnum = pgEnum("category", CATEGORY_LIST);

export type ObjectType =
  | "bottle"
  | "comment"
  | "entity"
  | "tasting"
  | "toast"
  | "follow";

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
  "comment",
  "entity",
  "tasting",
  "toast",
  "follow",
]);
