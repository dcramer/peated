import type { Category } from "@peated/shared/types";

import type { IBadge, TastingWithRelations } from "./base";

export type CategoryConfig = {
  category: Category;
};

export const CategoryBadge: IBadge<CategoryConfig> = {
  test: (config: CategoryConfig, tasting: TastingWithRelations) => {
    return tasting.bottle.category === config.category;
  },
};
