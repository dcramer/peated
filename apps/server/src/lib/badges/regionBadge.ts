import { z } from "zod";
import type { IBadge, TastingWithRelations } from "./base";

export const RegionConfig = z.object({
  regions: z.array(
    z.object({
      countryId: z.number(),
      region: z.string(),
    }),
  ),
});

type RegionConfigType = z.infer<typeof RegionConfig>;

export const RegionBadge: IBadge<RegionConfigType> = {
  test: (config: RegionConfigType, tasting: TastingWithRelations) => {
    const { brand, bottlesToDistillers } = tasting.bottle;

    for (const { region, countryId } of config.regions) {
      if (countryId === brand.countryId && region === brand.region) return true;
      if (
        bottlesToDistillers.find(
          ({ distiller: d }) =>
            countryId === d.countryId && region === d.region,
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
