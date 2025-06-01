import { bottles } from "@peated/server/db/schema";
import { CategoryEnum } from "@peated/server/schemas/common";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import type { TastingWithRelations } from "../types";
import { Check } from "./base";

export const CategoryCheckConfigSchema = z.object({
  category: z.array(CategoryEnum).min(1, "At least one category is required."),
});

export class CategoryCheck extends Check {
  schema = CategoryCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof CategoryCheckConfigSchema>) {
    return [inArray(bottles.category, config.category)];
  }

  test(
    config: z.infer<typeof CategoryCheckConfigSchema>,
    tasting: TastingWithRelations
  ) {
    if (!tasting.bottle.category) return false;
    return config.category.includes(tasting.bottle.category);
  }
}
