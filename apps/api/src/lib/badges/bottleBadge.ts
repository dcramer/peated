import type { IBadge, TastingWithRelations } from "./base";

export type BottleConfig = {
  id: number[];
};

export const BottleBadge: IBadge<BottleConfig> = {
  test: (config: BottleConfig, tasting: TastingWithRelations) => {
    return config.id.indexOf(tasting.bottle.id) !== -1;
  },
};
