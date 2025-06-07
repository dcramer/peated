import { bottles } from "@peated/server/db/schema";
import { inArray } from "drizzle-orm";
import type { z } from "zod";
import type { TastingWithRelations } from "../../types";
import { Check } from "../base";
import { CategoryCheckConfigSchema } from "./schema";

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
