import { z } from "zod";
import type { IBadge, TastingWithRelations } from "./base";

export const BottleConfig = z.object({
  id: z.array(z.number()),
});

type BottleConfigType = z.infer<typeof BottleConfig>;

export const BottleBadge: IBadge<BottleConfigType> = {
  test: (config: BottleConfigType, tasting: TastingWithRelations) => {
    return config.id.includes(tasting.bottle.id);
  },

  checkConfig: async (config: unknown) => {
    return BottleConfig.parse(config);
  },
};
