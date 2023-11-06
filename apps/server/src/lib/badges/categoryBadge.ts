import { z } from "zod";

import { CategoryEnum } from "../../schemas";

import type { IBadge, TastingWithRelations } from "./base";

export const CategoryConfig = z.object({
  category: z.array(CategoryEnum),
});

type CategoryConfigType = z.infer<typeof CategoryConfig>;

export const CategoryBadge: IBadge<CategoryConfigType> = {
  test: (config: CategoryConfigType, tasting: TastingWithRelations) => {
    if (!tasting.bottle.category) return false;
    return config.category.includes(tasting.bottle.category);
  },

  checkConfig: async (config: unknown) => {
    return CategoryConfig.parse(config);
  },
};
