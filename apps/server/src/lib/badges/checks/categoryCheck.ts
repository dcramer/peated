import { CategoryEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import type { BadgeTasting } from "../types";

export const CategoryCheckConfigSchema = z.object({
  category: z.array(CategoryEnum).min(1, "At least one category is required."),
});

export class CategoryCheck {
  test(
    config: z.infer<typeof CategoryCheckConfigSchema>,
    tasting: BadgeTasting,
  ) {
    if (tasting.identity.category === null) return false;
    return config.category.includes(tasting.identity.category);
  }
}
