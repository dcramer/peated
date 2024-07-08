import { z } from "zod";
import type { IBadge, TastingWithRelations } from "./base";

export const RegionConfig = z.object({
  regions: z.array(
    z.object({
      countryId: z.number(),
      regionId: z.number(),
    }),
  ),
});

type RegionConfigType = z.infer<typeof RegionConfig>;

export const RegionBadge: IBadge<RegionConfigType> = {
  test: (config: RegionConfigType, tasting: TastingWithRelations) => {
    const { brand, bottlesToDistillers } = tasting.bottle;

    for (const { regionId, countryId } of config.regions) {
      if (countryId === brand.countryId && regionId === brand.regionId)
        return true;
      if (
        bottlesToDistillers.find(
          ({ distiller: d }) =>
            countryId === d.countryId && regionId === d.regionId,
        )
      )
        return true;
    }
    return false;
  },

  checkConfig: async (config: unknown) => {
    return RegionConfig.parse(config);
  },
};
